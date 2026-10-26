-- Storefront publik: pelanggan pesan langsung dari web (root /) tanpa login.
-- Pesanan disimpan di tabel orders (bukan sales); staf memproses di /pesanan
-- dan mengubah statusnya. Stok dikurangi saat pesanan dibuat (anti oversell),
-- dikembalikan bila pesanan dibatalkan.
--
-- Pembayaran: cod (bayar saat serah terima) atau qris (gambar QRIS dari
-- store-assets + pelanggan upload bukti ke bucket payment-proofs).

-- ============ TABEL ORDERS ============
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  fulfillment text NOT NULL CHECK (fulfillment IN ('pickup', 'delivery')),
  address text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  payment_type text NOT NULL CHECK (payment_type IN ('cod', 'qris')),
  payment_proof_path text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'ready', 'completed', 'cancelled')),
  subtotal numeric(15,2) NOT NULL CHECK (subtotal >= 0),
  total numeric(15,2) NOT NULL CHECK (total >= 0),
  cancel_reason text NOT NULL DEFAULT '',
  processed_by uuid REFERENCES public.profiles (id),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_orders_status_created ON public.orders (status, created_at DESC);
CREATE INDEX idx_orders_created ON public.orders (created_at DESC);
CREATE INDEX idx_orders_phone ON public.orders (customer_phone);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  product_name text NOT NULL,
  variant_name text NOT NULL DEFAULT '',
  qty numeric(15,3) NOT NULL CHECK (qty > 0),
  unit_price numeric(15,2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(15,2) NOT NULL CHECK (line_total >= 0)
);
CREATE INDEX idx_order_items_order ON public.order_items (order_id);

-- RLS: karyawan terautentikasi boleh membaca (halaman /pesanan);
-- semua tulis lewat fungsi/service role di bawah.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_select_authenticated
  ON public.orders FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY order_items_select_authenticated
  ON public.order_items FOR SELECT TO authenticated USING (TRUE);

-- Siklus hidup stok pesanan online: keluar saat pesan, masuk saat batal.
ALTER TABLE public.stock_movements DROP CONSTRAINT stock_movements_type_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN (
    'sale', 'purchase', 'adjust', 'return_in', 'return_out', 'opname', 'void',
    'online_order', 'online_cancel'
  ));

-- ============ PERMISSION ============
INSERT INTO public.permissions (code, description)
VALUES ('order.manage', 'Proses pesanan online dari web publik')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'order.manage'
WHERE r.name IN ('Owner', 'Admin', 'Manajer', 'Kasir')
ON CONFLICT DO NOTHING;

-- ============ BUCKET BUKTI BAYAR ============
-- Private; tanpa policy → hanya service role (bypass RLS) yang dapat
-- membaca/menulis. Pelanggan upload lewat API route, staf melihat via
-- signed URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============ FUNGSI: BUAT PESANAN ============
-- Dipanggil dari API route publik via service role. Memvalidasi payload,
-- mengurangi stok per varian (kunci baris, urutan variant_id anti-deadlock),
-- lalu menyimpan pesanan + item + mutasi stok secara atomik.
CREATE OR REPLACE FUNCTION public.place_online_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := NULLIF(btrim(COALESCE(p_payload->>'customer_name', '')), '');
  v_phone text := NULLIF(btrim(COALESCE(p_payload->>'customer_phone', '')), '');
  v_fulfillment text := p_payload->>'fulfillment';
  v_address text := NULLIF(btrim(COALESCE(p_payload->>'address', '')), '');
  v_note text := left(btrim(COALESCE(p_payload->>'note', '')), 300);
  v_payment text := p_payload->>'payment_type';
  v_items jsonb := COALESCE(p_payload->'items', '[]'::jsonb);
  v_order_id uuid;
  v_order_no text;
  v_created_at timestamptz;
  v_subtotal numeric(15,2) := 0;
  v_item record;
  v_line numeric(15,2);
BEGIN
  IF v_name IS NULL OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;
  IF v_phone IS NULL OR v_phone !~ '^[0-9+() -]{8,20}$' THEN
    RAISE EXCEPTION 'INVALID_PHONE';
  END IF;
  IF v_fulfillment NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'INVALID_FULFILLMENT';
  END IF;
  IF v_fulfillment = 'delivery'
     AND (v_address IS NULL OR char_length(v_address) > 300) THEN
    RAISE EXCEPTION 'INVALID_ADDRESS';
  END IF;
  IF v_payment NOT IN ('cod', 'qris') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT';
  END IF;
  IF jsonb_typeof(v_items) <> 'array'
     OR jsonb_array_length(v_items) < 1
     OR jsonb_array_length(v_items) > 50 THEN
    RAISE EXCEPTION 'INVALID_ITEMS';
  END IF;
  IF (SELECT count(DISTINCT (it->>'variant_id')::uuid)
      FROM jsonb_array_elements(v_items) it)
     <> jsonb_array_length(v_items) THEN
    RAISE EXCEPTION 'DUPLICATE_ITEM';
  END IF;

  v_order_id := gen_random_uuid();
  v_order_no := 'ORD-'
    || to_char(now(), 'YYYYMMDD')
    || '-'
    || lpad(public.next_number('order')::text, 4, '0');

  -- Kunci baris stok urut variant_id (anti-deadlock) sebelum validasi.
  PERFORM 1
  FROM public.stocks
  WHERE variant_id IN (
    SELECT (it->>'variant_id')::uuid FROM jsonb_array_elements(v_items) it
  )
  ORDER BY variant_id
  FOR UPDATE;

  -- Baris pesanan dibuat dulu (subtotal menyusul setelah item dihitung).
  INSERT INTO public.orders
    (id, order_no, customer_name, customer_phone, fulfillment, address, note,
     payment_type, subtotal, total)
  VALUES
    (v_order_id, v_order_no, v_name, v_phone, v_fulfillment,
     COALESCE(v_address, ''), v_note, v_payment, 0, 0)
  RETURNING created_at INTO v_created_at;

  FOR v_item IN
    SELECT
      i.variant_id,
      i.qty,
      v.sell_price,
      v.deleted_at,
      v.track_stock,
      p.is_active AS product_active,
      p.name AS product_name,
      COALESCE(NULLIF(btrim(v.variant_name), ''), p.name) AS variant_name,
      COALESCE(s.qty, 0) AS stock_qty
    FROM (
      SELECT (it->>'variant_id')::uuid AS variant_id,
             (it->>'qty')::numeric AS qty
      FROM jsonb_array_elements(v_items) it
    ) i
    JOIN public.product_variants v ON v.id = i.variant_id
    JOIN public.products p ON p.id = v.product_id
    LEFT JOIN public.stocks s ON s.variant_id = v.id
  LOOP
    IF v_item.qty IS NULL OR v_item.qty <= 0
       OR v_item.qty <> floor(v_item.qty) OR v_item.qty > 99 THEN
      RAISE EXCEPTION 'INVALID_QTY';
    END IF;
    IF v_item.deleted_at IS NOT NULL OR v_item.product_active <> TRUE THEN
      RAISE EXCEPTION 'VARIANT_INACTIVE';
    END IF;
    IF v_item.track_stock AND v_item.stock_qty < v_item.qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK';
    END IF;

    v_line := round(v_item.qty * v_item.sell_price, 2);
    v_subtotal := v_subtotal + v_line;

    IF v_item.track_stock THEN
      UPDATE public.stocks
      SET qty = qty - v_item.qty
      WHERE variant_id = v_item.variant_id;

      INSERT INTO public.stock_movements
        (variant_id, type, qty_change, balance_after, ref_type, ref_id, note)
      SELECT
        v_item.variant_id, 'online_order', -v_item.qty, s.qty,
        'order', v_order_id, 'Pesanan online ' || v_order_no
      FROM public.stocks s
      WHERE s.variant_id = v_item.variant_id;
    END IF;

    INSERT INTO public.order_items
      (order_id, variant_id, product_name, variant_name, qty, unit_price, line_total)
    VALUES
      (v_order_id, v_item.variant_id, v_item.product_name, v_item.variant_name,
       v_item.qty, v_item.sell_price, v_line);
  END LOOP;

  UPDATE public.orders
  SET subtotal = v_subtotal, total = v_subtotal
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_no', v_order_no,
    'subtotal', v_subtotal,
    'total', v_subtotal,
    'created_at', v_created_at
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.place_online_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_online_order(jsonb) TO service_role;

-- ============ FUNGSI: BATALKAN PESANAN ============
-- Mengembalikan stok + mengubah status secara atomik. Dipanggil dari halaman
-- staf (service role) maupun RPC authenticated.
CREATE OR REPLACE FUNCTION public.cancel_online_order(
  p_order_id uuid,
  p_reason text,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item record;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.status NOT IN ('pending', 'confirmed', 'ready') THEN
    RAISE EXCEPTION 'ORDER_NOT_CANCELLABLE';
  END IF;

  FOR v_item IN
    SELECT oi.variant_id, oi.qty, v.track_stock
    FROM public.order_items oi
    JOIN public.product_variants v ON v.id = oi.variant_id
    WHERE oi.order_id = p_order_id
    ORDER BY oi.variant_id
    FOR UPDATE
  LOOP
    IF v_item.track_stock THEN
      UPDATE public.stocks
      SET qty = qty + v_item.qty
      WHERE variant_id = v_item.variant_id;

      INSERT INTO public.stock_movements
        (variant_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by)
      SELECT
        v_item.variant_id, 'online_cancel', v_item.qty, s.qty,
        'order', p_order_id,
        'Batalkan pesanan online ' || v_order.order_no, p_actor
      FROM public.stocks s
      WHERE s.variant_id = v_item.variant_id;
    END IF;
  END LOOP;

  UPDATE public.orders
  SET status = 'cancelled',
      cancel_reason = left(COALESCE(NULLIF(btrim(p_reason), ''), 'Dibatalkan staf'), 300),
      processed_by = p_actor,
      processed_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN to_jsonb(v_order);
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_online_order(uuid, text, uuid) TO authenticated, service_role;

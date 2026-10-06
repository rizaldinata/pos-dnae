-- Sub-PRD 3.1: pembelian — supplier, PO, penerimaan, retur, hutang (PUR-01..04).
-- supplier_payments dibuat sekarang, dipakai penuh di 3.2.
-- RPC: create_purchase_order, receive_goods, create_purchase_return.

-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  payment_terms_days integer NOT NULL DEFAULT 0 CHECK (payment_terms_days >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ PURCHASE_ORDERS ============
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_no text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'partial', 'completed', 'cancelled')),
  order_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  notes text NOT NULL DEFAULT '',
  total numeric(15,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchase_orders_supplier_id ON public.purchase_orders (supplier_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders (status);
CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE RESTRICT,
  qty numeric(15,3) NOT NULL CHECK (qty > 0),
  cost_price numeric(15,2) NOT NULL CHECK (cost_price >= 0),
  received_qty numeric(15,3) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchase_order_items_po_id ON public.purchase_order_items (po_id);

-- ============ GOODS_RECEIPTS ============
CREATE TABLE public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_no text NOT NULL UNIQUE,
  po_id uuid NOT NULL REFERENCES public.purchase_orders (id) ON DELETE RESTRICT,
  received_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT '',
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_goods_receipts_po_id ON public.goods_receipts (po_id);

CREATE TABLE public.goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_id uuid NOT NULL REFERENCES public.goods_receipts (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE RESTRICT,
  qty numeric(15,3) NOT NULL CHECK (qty > 0),
  cost_price numeric(15,2) NOT NULL CHECK (cost_price >= 0),
  batch_no text NOT NULL DEFAULT '',
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_goods_receipt_items_gr_id ON public.goods_receipt_items (gr_id);

-- ============ PURCHASE_RETURNS ============
CREATE TABLE public.purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_no text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,
  reason text NOT NULL,
  total_refund numeric(15,2) NOT NULL DEFAULT 0 CHECK (total_refund >= 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchase_returns_supplier_id ON public.purchase_returns (supplier_id);

CREATE TABLE public.purchase_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.purchase_returns (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE RESTRICT,
  qty numeric(15,3) NOT NULL CHECK (qty > 0),
  cost_price numeric(15,2) NOT NULL CHECK (cost_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchase_return_items_return_id ON public.purchase_return_items (return_id);

-- ============ SUPPLIER_PAYMENTS (dipakai 3.2) ============
CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders (id) ON DELETE RESTRICT,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'cash',
  paid_at timestamptz NOT NULL DEFAULT now(),
  due_date date,
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_payments_po_id ON public.supplier_payments (po_id);

-- ============ RLS ============
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select_authenticated"
  ON public.suppliers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "suppliers_manage_purchasing_manager"
  ON public.suppliers FOR ALL TO authenticated
  USING (public.has_permission('purchasing.manage'))
  WITH CHECK (public.has_permission('purchasing.manage'));

CREATE POLICY "purchase_orders_select_authenticated"
  ON public.purchase_orders FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "purchase_orders_manage_purchasing_manager"
  ON public.purchase_orders FOR ALL TO authenticated
  USING (public.has_permission('purchasing.manage'))
  WITH CHECK (public.has_permission('purchasing.manage'));

CREATE POLICY "purchase_order_items_select_authenticated"
  ON public.purchase_order_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "purchase_order_items_manage_purchasing_manager"
  ON public.purchase_order_items FOR ALL TO authenticated
  USING (public.has_permission('purchasing.manage'))
  WITH CHECK (public.has_permission('purchasing.manage'));

-- Penerimaan & retur hanya lewat RPC (deny tulis langsung).
CREATE POLICY "goods_receipts_select_authenticated"
  ON public.goods_receipts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "goods_receipt_items_select_authenticated"
  ON public.goods_receipt_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "purchase_returns_select_authenticated"
  ON public.purchase_returns FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "purchase_return_items_select_authenticated"
  ON public.purchase_return_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "supplier_payments_select_authenticated"
  ON public.supplier_payments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "supplier_payments_manage_purchasing_manager"
  ON public.supplier_payments FOR ALL TO authenticated
  USING (public.has_permission('purchasing.manage'))
  WITH CHECK (public.has_permission('purchasing.manage'));

-- ============ RPC: create_purchase_order ============
CREATE OR REPLACE FUNCTION public.create_purchase_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id uuid := NULLIF(p_payload->>'supplier_id', '')::uuid;
  v_notes text := COALESCE(p_payload->>'notes', '');
  v_order_date date := COALESCE((p_payload->>'order_date')::date, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_po_id uuid;
  v_po_no text;
  v_total numeric(15,2) := 0;
  v_item jsonb;
  v_variant_id uuid;
  v_qty numeric(15,3);
  v_cost numeric(15,2);
BEGIN
  IF NOT public.has_permission('purchasing.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing purchasing.manage permission';
  END IF;

  IF v_supplier_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = v_supplier_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'SUPPLIER_NOT_FOUND:%', v_supplier_id;
  END IF;

  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'PO_ITEMS_REQUIRED';
  END IF;

  v_po_no := 'PO-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD')
    || '-' || lpad(public.next_number('po')::text, 4, '0');

  INSERT INTO public.purchase_orders (po_no, supplier_id, status, order_date, notes, total, created_by)
  VALUES (v_po_no, v_supplier_id, 'draft', v_order_date, v_notes, 0, auth.uid())
  RETURNING id INTO v_po_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::numeric;
    v_cost := COALESCE((v_item->>'cost_price')::numeric, 0);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_QTY:%', v_variant_id;
    END IF;
    IF v_cost IS NULL OR v_cost < 0 THEN
      RAISE EXCEPTION 'INVALID_COST:%', v_variant_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = v_variant_id) THEN
      RAISE EXCEPTION 'VARIANT_NOT_FOUND:%', v_variant_id;
    END IF;

    INSERT INTO public.purchase_order_items (po_id, variant_id, qty, cost_price)
    VALUES (v_po_id, v_variant_id, v_qty, v_cost);

    v_total := v_total + v_qty * v_cost;
  END LOOP;

  UPDATE public.purchase_orders SET total = v_total WHERE id = v_po_id;

  RETURN jsonb_build_object('po_id', v_po_id, 'po_no', v_po_no, 'total', v_total);
END;
$$;

-- ============ RPC: receive_goods ============
CREATE OR REPLACE FUNCTION public.receive_goods(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id uuid := NULLIF(p_payload->>'po_id', '')::uuid;
  v_note text := COALESCE(p_payload->>'note', '');
  v_po public.purchase_orders%ROWTYPE;
  v_gr_id uuid;
  v_gr_no text;
  v_item jsonb;
  v_variant_id uuid;
  v_qty numeric(15,3);
  v_cost numeric(15,2);
  v_batch_no text;
  v_expiry date;
  v_po_item record;
  v_stock_qty numeric(15,3);
BEGIN
  IF NOT public.has_permission('purchasing.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing purchasing.manage permission';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = v_po_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PO_NOT_FOUND:%', v_po_id;
  END IF;

  IF v_po.status NOT IN ('sent', 'partial') THEN
    RAISE EXCEPTION 'PO_NOT_RECEIVABLE:%', v_po.status;
  END IF;

  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'GR_ITEMS_REQUIRED';
  END IF;

  v_gr_no := 'GR-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD')
    || '-' || lpad(public.next_number('gr')::text, 4, '0');

  INSERT INTO public.goods_receipts (gr_no, po_id, note, received_by)
  VALUES (v_gr_no, v_po_id, v_note, auth.uid())
  RETURNING id INTO v_gr_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::numeric;
    v_cost := COALESCE((v_item->>'cost_price')::numeric, 0);
    v_batch_no := COALESCE(NULLIF(v_item->>'batch_no', ''), '');
    v_expiry := NULLIF(v_item->>'expiry_date', '')::date;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_QTY:%', v_variant_id;
    END IF;
    IF v_cost IS NULL OR v_cost < 0 THEN
      RAISE EXCEPTION 'INVALID_COST:%', v_variant_id;
    END IF;

    SELECT * INTO v_po_item FROM public.purchase_order_items
    WHERE po_id = v_po_id AND variant_id = v_variant_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PO_ITEM_NOT_FOUND:%', v_variant_id;
    END IF;

    IF v_po_item.received_qty + v_qty > v_po_item.qty THEN
      RAISE EXCEPTION 'OVER_RECEIVE:%', v_variant_id;
    END IF;

    INSERT INTO public.goods_receipt_items (gr_id, variant_id, qty, cost_price, batch_no, expiry_date)
    VALUES (v_gr_id, v_variant_id, v_qty, v_cost, v_batch_no, v_expiry);

    UPDATE public.stocks SET qty = qty + v_qty, updated_at = now()
    WHERE variant_id = v_variant_id
    RETURNING qty INTO v_stock_qty;

    INSERT INTO public.stock_movements (
      variant_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
    ) VALUES (
      v_variant_id, 'purchase', v_qty, v_stock_qty,
      'goods_receipt', v_gr_id, 'Penerimaan ' || v_gr_no, auth.uid()
    );

    -- Harga modal mengikuti harga beli terakhir.
    UPDATE public.product_variants
    SET cost_price = v_cost, updated_at = now()
    WHERE id = v_variant_id;

    UPDATE public.purchase_order_items
    SET received_qty = received_qty + v_qty
    WHERE po_id = v_po_id AND variant_id = v_variant_id;
  END LOOP;

  UPDATE public.purchase_orders
  SET status = CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM public.purchase_order_items
        WHERE po_id = v_po_id AND received_qty < qty
      ) THEN 'completed'::text
      ELSE 'partial'::text
    END,
    updated_at = now()
  WHERE id = v_po_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
  VALUES (
    auth.uid(), 'purchasing.receive', 'goods_receipts', v_gr_id::text,
    jsonb_build_object('gr_no', v_gr_no, 'po_id', v_po_id)
  );

  RETURN jsonb_build_object('gr_id', v_gr_id, 'gr_no', v_gr_no);
END;
$$;

-- ============ RPC: create_purchase_return ============
CREATE OR REPLACE FUNCTION public.create_purchase_return(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id uuid := NULLIF(p_payload->>'supplier_id', '')::uuid;
  v_reason text := NULLIF(btrim(COALESCE(p_payload->>'reason', '')), '');
  v_return_id uuid;
  v_return_no text;
  v_total numeric(15,2) := 0;
  v_item jsonb;
  v_variant_id uuid;
  v_qty numeric(15,3);
  v_cost numeric(15,2);
  v_stock_qty numeric(15,3);
BEGIN
  IF NOT public.has_permission('purchasing.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing purchasing.manage permission';
  END IF;

  IF v_supplier_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = v_supplier_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'SUPPLIER_NOT_FOUND:%', v_supplier_id;
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'RETURN_REASON_REQUIRED';
  END IF;

  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'RETURN_ITEMS_REQUIRED';
  END IF;

  v_return_no := 'PRTN-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD')
    || '-' || lpad(public.next_number('purchase_return')::text, 4, '0');

  INSERT INTO public.purchase_returns (return_no, supplier_id, reason, total_refund, created_by)
  VALUES (v_return_no, v_supplier_id, v_reason, 0, auth.uid())
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items') LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::numeric;
    v_cost := COALESCE((v_item->>'cost_price')::numeric, 0);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_QTY:%', v_variant_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = v_variant_id) THEN
      RAISE EXCEPTION 'VARIANT_NOT_FOUND:%', v_variant_id;
    END IF;

    SELECT qty INTO v_stock_qty FROM public.stocks
    WHERE variant_id = v_variant_id FOR UPDATE;

    IF v_stock_qty IS NULL OR v_stock_qty < v_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_variant_id;
    END IF;

    INSERT INTO public.purchase_return_items (return_id, variant_id, qty, cost_price)
    VALUES (v_return_id, v_variant_id, v_qty, v_cost);

    UPDATE public.stocks SET qty = qty - v_qty, updated_at = now()
    WHERE variant_id = v_variant_id
    RETURNING qty INTO v_stock_qty;

    INSERT INTO public.stock_movements (
      variant_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
    ) VALUES (
      v_variant_id, 'return_out', -v_qty, v_stock_qty,
      'purchase_return', v_return_id, 'Retur supplier: ' || v_reason, auth.uid()
    );

    v_total := v_total + v_qty * v_cost;
  END LOOP;

  UPDATE public.purchase_returns SET total_refund = v_total WHERE id = v_return_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
  VALUES (
    auth.uid(), 'purchasing.return', 'purchase_returns', v_return_id::text,
    jsonb_build_object('return_no', v_return_no, 'total_refund', v_total)
  );

  RETURN jsonb_build_object('return_id', v_return_id, 'return_no', v_return_no, 'total_refund', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_purchase_order(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_goods(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_return(jsonb) TO authenticated;

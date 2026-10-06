-- Sub-PRD 3.4: loyalitas pelanggan (CUS-02, POS-14, Bagian 6.5).
-- loyalty_transactions (earn/redeem/adjust);
-- create_sale: penukaran poin (diskon) + perolehan poin dibuat atomik;
-- adjust_loyalty_points: penyesuaian manual admin (atomic).

CREATE TABLE public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  sale_id uuid REFERENCES public.sales (id) ON DELETE CASCADE,
  points integer NOT NULL CHECK (points <> 0),
  type text NOT NULL CHECK (type IN ('earn', 'redeem', 'adjust')),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_transactions_customer_created
  ON public.loyalty_transactions (customer_id, created_at DESC);
CREATE INDEX idx_loyalty_transactions_sale_id
  ON public.loyalty_transactions (sale_id);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_transactions_select_authenticated"
  ON public.loyalty_transactions FOR SELECT TO authenticated USING (TRUE);
-- Tulis hanya lewat create_sale / adjust_loyalty_points (tidak ada policy tulis).

-- Baca angka dari tabel settings (key-value jsonb) dengan nilai default.
CREATE OR REPLACE FUNCTION public.get_setting_number(p_key text, p_default numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (s.value #>> '{}')::numeric FROM public.settings s WHERE s.key = p_key),
    p_default
  );
$$;

-- create_sale + penukaran & perolehan poin. Sama seperti versi 3.3 (promo/voucher/gift),
-- plus:
--   redeem_points: validasi saldo pelanggan + nilai poin dari settings (otoritatif),
--     dihitung sebagai diskon sebelum pajak; baris loyalty type='redeem' + saldo berkurang.
--   Perolehan poin: floor(grand_total / loyalty.earn_ratio) bila ada pelanggan,
--     dicatat type='earn' + saldo bertambah — satu transaksi atomik dengan penjualan.
CREATE OR REPLACE FUNCTION public.create_sale(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idempotency_key text := NULLIF(p_payload->>'idempotency_key', '');
  v_user_id uuid := NULLIF(p_payload->>'user_id', '')::uuid;
  v_shift_id uuid := NULLIF(p_payload->>'shift_id', '')::uuid;
  v_customer_id uuid := NULLIF(p_payload->>'customer_id', '')::uuid;
  v_allow_negative boolean := COALESCE((p_payload->>'allow_negative_stock')::boolean, FALSE);
  v_is_credit boolean := COALESCE((p_payload->>'is_credit')::boolean, FALSE);
  v_promotion_id uuid := NULLIF(p_payload->>'promotion_id', '')::uuid;
  v_voucher_code text := NULLIF(btrim(COALESCE(p_payload->>'voucher_code', '')), '');
  v_redeem_points integer := GREATEST(
    floor(COALESCE((p_payload->>'redeem_points')::numeric, 0))::integer, 0);
  v_tax_total numeric(15,2) := COALESCE((p_payload->>'tax_total')::numeric, 0);
  v_service_fee numeric(15,2) := COALESCE((p_payload->>'service_fee')::numeric, 0);
  v_rounding numeric(15,2) := COALESCE((p_payload->>'rounding')::numeric, 0);
  v_trx_discount numeric(15,2) := COALESCE((p_payload->>'transaction_discount')::numeric, 0);
  v_status text;
  v_existing_id uuid;
  v_sale_id uuid;
  v_invoice_no text;
  v_subtotal numeric(15,2) := 0;
  v_discount_total numeric(15,2) := 0;
  v_voucher_discount numeric(15,2) := 0;
  v_voucher_id uuid;
  v_redeem_discount numeric(15,2) := 0;
  v_point_value numeric(15,2);
  v_earn_ratio numeric(15,2);
  v_points_earned integer := 0;
  v_customer_points integer;
  v_grand_total numeric(15,2);
  v_paid_total numeric(15,2) := 0;
  v_change numeric(15,2);
  v_receivable numeric(15,2) := 0;
  v_item jsonb;
  v_payment jsonb;
  v_variant_id uuid;
  v_qty numeric(15,3);
  v_discount numeric(15,2);
  v_is_gift boolean;
  v_sell_price numeric(15,2);
  v_effective_price numeric(15,2);
  v_cost_price numeric(15,2);
  v_product_name text;
  v_sku text;
  v_stock_qty numeric(15,3);
  v_line_total numeric(15,2);
  v_payment_method_id uuid;
  v_amount numeric(15,2);
  v_reference_no text;
  v_method_active boolean;
  v_voucher record;
  v_voucher_base numeric(15,2);
BEGIN
  IF NOT public.has_permission('sale.create') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing sale.create permission';
  END IF;

  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'ITEMS_REQUIRED';
  END IF;

  IF v_is_credit THEN
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'CREDIT_CUSTOMER_REQUIRED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_FOUND:%', v_customer_id;
    END IF;
  ELSE
    IF jsonb_typeof(p_payload->'payments') <> 'array' OR jsonb_array_length(p_payload->'payments') = 0 THEN
      RAISE EXCEPTION 'PAYMENTS_REQUIRED';
    END IF;
  END IF;

  IF v_trx_discount < 0 THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT:transaction';
  END IF;

  IF v_promotion_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.promotions
      WHERE id = v_promotion_id AND is_active
        AND now() BETWEEN start_at AND end_at
    ) THEN
      RAISE EXCEPTION 'INVALID_PROMOTION:%', v_promotion_id;
    END IF;
  END IF;

  SELECT id INTO v_existing_id FROM public.sales WHERE idempotency_key = v_idempotency_key;
  IF v_existing_id IS NOT NULL THEN
    RETURN public.build_sale_receipt(v_existing_id);
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_payload->'items')
    ORDER BY (value->>'variant_id')
  LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::numeric;
    v_discount := COALESCE((v_item->>'discount')::numeric, 0);
    v_is_gift := COALESCE((v_item->>'is_gift')::boolean, FALSE);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_QTY:%', v_variant_id;
    END IF;
    IF v_discount < 0 THEN
      RAISE EXCEPTION 'INVALID_DISCOUNT:%', v_variant_id;
    END IF;

    SELECT pv.sell_price, pv.cost_price, p.name, pv.sku
      INTO v_sell_price, v_cost_price, v_product_name, v_sku
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id AND p.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'VARIANT_NOT_FOUND:%', v_variant_id;
    END IF;

    IF v_is_gift THEN
      v_effective_price := 0;
      IF v_discount <> 0 THEN
        RAISE EXCEPTION 'INVALID_DISCOUNT:%', v_variant_id;
      END IF;
    ELSE
      SELECT pt.price INTO v_effective_price
      FROM public.price_tiers pt
      WHERE pt.variant_id = v_variant_id AND pt.min_qty <= v_qty
      ORDER BY pt.min_qty DESC
      LIMIT 1;
      IF NOT FOUND OR v_effective_price IS NULL THEN
        v_effective_price := v_sell_price;
      END IF;
    END IF;

    SELECT qty INTO v_stock_qty
    FROM public.stocks
    WHERE variant_id = v_variant_id
    FOR UPDATE;

    IF v_stock_qty IS NULL THEN
      RAISE EXCEPTION 'VARIANT_NOT_FOUND:%', v_variant_id;
    END IF;

    IF NOT v_allow_negative AND v_stock_qty < v_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_sku;
    END IF;

    v_line_total := v_qty * v_effective_price;
    IF v_discount > v_line_total THEN
      RAISE EXCEPTION 'INVALID_DISCOUNT:%', v_variant_id;
    END IF;

    v_subtotal := v_subtotal + v_line_total;
    v_discount_total := v_discount_total + v_discount;
  END LOOP;

  IF v_trx_discount > v_subtotal - v_discount_total THEN
    RAISE EXCEPTION 'INVALID_DISCOUNT:transaction';
  END IF;
  v_discount_total := v_discount_total + v_trx_discount;

  -- Voucher: validasi penuh + hitung dari dasar setelah diskon.
  IF v_voucher_code IS NOT NULL THEN
    SELECT * INTO v_voucher FROM public.vouchers
    WHERE code = v_voucher_code FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_VOUCHER:not found';
    END IF;
    IF NOT v_voucher.is_active THEN
      RAISE EXCEPTION 'INVALID_VOUCHER:inactive';
    END IF;
    IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
      RAISE EXCEPTION 'INVALID_VOUCHER:expired';
    END IF;
    IF v_voucher.used_count >= v_voucher.quota THEN
      RAISE EXCEPTION 'INVALID_VOUCHER:quota';
    END IF;

    v_voucher_base := v_subtotal - v_discount_total;
    IF v_voucher_base < v_voucher.min_purchase THEN
      RAISE EXCEPTION 'INVALID_VOUCHER:min purchase';
    END IF;

    IF v_voucher.type = 'percent' THEN
      v_voucher_discount := LEAST(round(v_voucher_base * v_voucher.value / 100, 2), v_voucher_base);
    ELSE
      v_voucher_discount := LEAST(v_voucher.value, v_voucher_base);
    END IF;

    v_discount_total := v_discount_total + v_voucher_discount;
    v_voucher_id := v_voucher.id;
  END IF;

  -- Penukaran poin (POS-14): wajib pelanggan, saldo cukup, nilai poin dari
  -- settings; diskon dihitung server dan tidak boleh melebihi sisa tagihan.
  IF v_redeem_points > 0 THEN
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'REDEEM_CUSTOMER_REQUIRED';
    END IF;

    SELECT points INTO v_customer_points
    FROM public.customers
    WHERE id = v_customer_id AND deleted_at IS NULL
    FOR UPDATE;

    IF v_customer_points IS NULL THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_FOUND:%', v_customer_id;
    END IF;
    IF v_customer_points < v_redeem_points THEN
      RAISE EXCEPTION 'INSUFFICIENT_POINTS:%', v_redeem_points;
    END IF;

    v_point_value := public.get_setting_number('loyalty.point_value', 100);
    v_redeem_discount := v_redeem_points * v_point_value;
    IF v_redeem_discount > v_subtotal - v_discount_total THEN
      RAISE EXCEPTION 'REDEEM_EXCEEDS_TOTAL';
    END IF;

    v_discount_total := v_discount_total + v_redeem_discount;
  END IF;

  v_grand_total := v_subtotal - v_discount_total + v_tax_total + v_service_fee + v_rounding;
  IF v_grand_total < 0 THEN
    RAISE EXCEPTION 'INVALID_TOTAL';
  END IF;

  IF jsonb_typeof(p_payload->'payments') = 'array' THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payload->'payments') LOOP
      v_payment_method_id := (v_payment->>'payment_method_id')::uuid;
      v_amount := (v_payment->>'amount')::numeric;

      IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT';
      END IF;

      SELECT is_active INTO v_method_active
      FROM public.payment_methods
      WHERE id = v_payment_method_id AND deleted_at IS NULL;

      IF NOT FOUND OR NOT v_method_active THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_METHOD:%', v_payment_method_id;
      END IF;

      v_paid_total := v_paid_total + v_amount;
    END LOOP;
  END IF;

  IF v_is_credit THEN
    v_status := 'credit';
    v_receivable := v_grand_total - v_paid_total;
    IF v_receivable < 0 THEN
      RAISE EXCEPTION 'OVERPAY:paid exceeds total';
    END IF;
    v_change := 0;
  ELSE
    IF v_paid_total < v_grand_total THEN
      RAISE EXCEPTION 'UNDERPAID:paid % < total %', v_paid_total, v_grand_total;
    END IF;
    v_status := 'completed';
    v_change := v_paid_total - v_grand_total;
  END IF;

  v_invoice_no := 'INV-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD')
    || '-' || lpad(public.next_number('invoice')::text, 4, '0');

  INSERT INTO public.sales (
    invoice_no, idempotency_key, shift_id, user_id, customer_id,
    subtotal, discount_total, tax_total, service_fee, rounding,
    grand_total, paid_total, change_amount, status, promotion_id, voucher_id
  ) VALUES (
    v_invoice_no, v_idempotency_key, v_shift_id, v_user_id, v_customer_id,
    v_subtotal, v_discount_total, v_tax_total, v_service_fee, v_rounding,
    v_grand_total, v_paid_total, v_change, v_status, v_promotion_id, v_voucher_id
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_payload->'items')
    ORDER BY (value->>'variant_id')
  LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::numeric;
    v_discount := COALESCE((v_item->>'discount')::numeric, 0);
    v_is_gift := COALESCE((v_item->>'is_gift')::boolean, FALSE);

    SELECT pv.sell_price, pv.cost_price, p.name, pv.sku
      INTO v_sell_price, v_cost_price, v_product_name, v_sku
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id;

    IF v_is_gift THEN
      v_effective_price := 0;
    ELSE
      SELECT pt.price INTO v_effective_price
      FROM public.price_tiers pt
      WHERE pt.variant_id = v_variant_id AND pt.min_qty <= v_qty
      ORDER BY pt.min_qty DESC
      LIMIT 1;
      IF NOT FOUND OR v_effective_price IS NULL THEN
        v_effective_price := v_sell_price;
      END IF;
    END IF;

    v_line_total := v_qty * v_effective_price;

    INSERT INTO public.sale_items (
      sale_id, variant_id, product_name, sku, qty,
      unit_price, cost_price, discount, subtotal, is_gift
    ) VALUES (
      v_sale_id, v_variant_id, v_product_name, v_sku, v_qty,
      v_effective_price, v_cost_price, v_discount, v_line_total - v_discount, v_is_gift
    );

    UPDATE public.stocks SET qty = qty - v_qty WHERE variant_id = v_variant_id
    RETURNING qty INTO v_stock_qty;

    INSERT INTO public.stock_movements (
      variant_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
    ) VALUES (
      v_variant_id, 'sale', -v_qty, v_stock_qty, 'sale', v_sale_id,
      'Penjualan ' || v_invoice_no, v_user_id
    );
  END LOOP;

  IF jsonb_typeof(p_payload->'payments') = 'array' THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payload->'payments') LOOP
      v_payment_method_id := (v_payment->>'payment_method_id')::uuid;
      v_amount := (v_payment->>'amount')::numeric;
      v_reference_no := NULLIF(v_payment->>'reference_no', '');

      INSERT INTO public.sale_payments (sale_id, payment_method_id, amount, reference_no)
      VALUES (v_sale_id, v_payment_method_id, v_amount, v_reference_no);
    END LOOP;
  END IF;

  IF v_voucher_id IS NOT NULL THEN
    UPDATE public.vouchers SET used_count = used_count + 1, updated_at = now()
    WHERE id = v_voucher_id;

    INSERT INTO public.voucher_usages (voucher_id, sale_id, discount_amount)
    VALUES (v_voucher_id, v_sale_id, v_voucher_discount);
  END IF;

  IF v_is_credit AND v_receivable > 0 THEN
    UPDATE public.customers
    SET receivable_balance = receivable_balance + v_receivable, updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  -- Loyalitas (CUS-02, POS-14): penukaran & perolehan poin dalam transaksi yang sama.
  IF v_customer_id IS NOT NULL THEN
    v_earn_ratio := public.get_setting_number('loyalty.earn_ratio', 10000);
    IF v_earn_ratio > 0 THEN
      v_points_earned := floor(v_grand_total / v_earn_ratio)::integer;
    END IF;

    IF v_redeem_points > 0 THEN
      INSERT INTO public.loyalty_transactions (customer_id, sale_id, points, type, created_by)
      VALUES (v_customer_id, v_sale_id, -v_redeem_points, 'redeem', v_user_id);
    END IF;

    IF v_points_earned > 0 THEN
      INSERT INTO public.loyalty_transactions (customer_id, sale_id, points, type, created_by)
      VALUES (v_customer_id, v_sale_id, v_points_earned, 'earn', v_user_id);
    END IF;

    IF v_redeem_points > 0 OR v_points_earned > 0 THEN
      UPDATE public.customers
      SET points = points - v_redeem_points + v_points_earned, updated_at = now()
      WHERE id = v_customer_id;
    END IF;
  END IF;

  RETURN public.build_sale_receipt(v_sale_id);
END;
$$;

-- Penyesuaian poin manual (admin): atomic saldo + riwayat, tanpa kunci transaksi.
CREATE OR REPLACE FUNCTION public.adjust_loyalty_points(
  p_customer_id uuid,
  p_points integer,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_current integer;
  v_new integer;
  v_txn_id uuid;
BEGIN
  IF NOT public.has_permission('customer.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing customer.manage permission';
  END IF;

  IF p_points IS NULL OR p_points = 0 THEN
    RAISE EXCEPTION 'INVALID_POINTS';
  END IF;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'ADJUST_REASON_REQUIRED';
  END IF;

  SELECT points INTO v_current
  FROM public.customers
  WHERE id = p_customer_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND:%', p_customer_id;
  END IF;

  v_new := v_current + p_points;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS:%', v_current;
  END IF;

  INSERT INTO public.loyalty_transactions (customer_id, points, type, note, created_by)
  VALUES (p_customer_id, p_points, 'adjust', v_note, auth.uid())
  RETURNING id INTO v_txn_id;

  UPDATE public.customers
  SET points = v_new, updated_at = now()
  WHERE id = p_customer_id;

  RETURN jsonb_build_object(
    'id', v_txn_id,
    'customer_id', p_customer_id,
    'points', p_points,
    'type', 'adjust',
    'note', v_note,
    'balance', v_new
  );
END;
$$;

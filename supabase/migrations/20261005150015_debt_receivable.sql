-- Sub-PRD 3.2: hutang & piutang (PUR-05, CUS-03, POS-12).
-- receivable_payments: cicilan piutang (tulis hanya via RPC).
-- record_receivable_payment: catat bayar + kurangi saldo (tolak overpay).
-- create_sale: mode kredit (tanpa/under bayar, status 'credit',
--   syarat pelanggan terdaftar, saldo piutang bertambah).

CREATE TABLE public.receivable_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  sale_id uuid REFERENCES public.sales (id) ON DELETE RESTRICT,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  payment_method_id uuid REFERENCES public.payment_methods (id) ON DELETE RESTRICT,
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_receivable_payments_customer_id ON public.receivable_payments (customer_id);
CREATE INDEX idx_receivable_payments_sale_id ON public.receivable_payments (sale_id);

ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receivable_payments_select_authenticated"
  ON public.receivable_payments FOR SELECT TO authenticated USING (TRUE);
-- Tulis hanya lewat RPC record_receivable_payment (tidak ada policy tulis).

CREATE OR REPLACE FUNCTION public.record_receivable_payment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid := NULLIF(p_payload->>'customer_id', '')::uuid;
  v_sale_id uuid := NULLIF(p_payload->>'sale_id', '')::uuid;
  v_amount numeric(15,2) := (p_payload->>'amount')::numeric;
  v_method_id uuid := NULLIF(p_payload->>'payment_method_id', '')::uuid;
  v_note text := COALESCE(p_payload->>'note', '');
  v_balance numeric(15,2);
  v_payment_id uuid;
BEGIN
  IF NOT public.has_permission('sale.create') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing sale.create permission';
  END IF;

  SELECT receivable_balance INTO v_balance
  FROM public.customers
  WHERE id = v_customer_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND:%', v_customer_id;
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT';
  END IF;

  IF v_amount > v_balance THEN
    RAISE EXCEPTION 'OVERPAY:amount % exceeds balance %', v_amount, v_balance;
  END IF;

  IF v_sale_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sales WHERE id = v_sale_id AND customer_id = v_customer_id
  ) THEN
    RAISE EXCEPTION 'SALE_NOT_FOUND:%', v_sale_id;
  END IF;

  IF v_method_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.payment_methods
    WHERE id = v_method_id AND is_active AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD:%', v_method_id;
  END IF;

  INSERT INTO public.receivable_payments (
    customer_id, sale_id, amount, payment_method_id, note, created_by
  ) VALUES (
    v_customer_id, v_sale_id, v_amount, v_method_id, v_note, auth.uid()
  ) RETURNING id INTO v_payment_id;

  UPDATE public.customers
  SET receivable_balance = receivable_balance - v_amount, updated_at = now()
  WHERE id = v_customer_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
  VALUES (
    auth.uid(), 'receivable.pay', 'receivable_payments', v_payment_id::text,
    jsonb_build_object('customer_id', v_customer_id, 'amount', v_amount)
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'new_balance', v_balance - v_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_receivable_payment(jsonb) TO authenticated;

-- create_sale + mode kredit. Sama seperti versi 2.5 + tier, ditambah:
-- p_is_credit -> lewati cek UNDERPAID, izinkan payments kosong,
-- status 'credit', saldo piutang += grand - paid.
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
  v_grand_total numeric(15,2);
  v_paid_total numeric(15,2) := 0;
  v_change numeric(15,2);
  v_receivable numeric(15,2) := 0;
  v_item jsonb;
  v_payment jsonb;
  v_variant_id uuid;
  v_qty numeric(15,3);
  v_discount numeric(15,2);
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

    SELECT pt.price INTO v_effective_price
    FROM public.price_tiers pt
    WHERE pt.variant_id = v_variant_id AND pt.min_qty <= v_qty
    ORDER BY pt.min_qty DESC
    LIMIT 1;
    IF NOT FOUND OR v_effective_price IS NULL THEN
      v_effective_price := v_sell_price;
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
    grand_total, paid_total, change_amount, status
  ) VALUES (
    v_invoice_no, v_idempotency_key, v_shift_id, v_user_id, v_customer_id,
    v_subtotal, v_discount_total, v_tax_total, v_service_fee, v_rounding,
    v_grand_total, v_paid_total, v_change, v_status
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_payload->'items')
    ORDER BY (value->>'variant_id')
  LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'qty')::numeric;
    v_discount := COALESCE((v_item->>'discount')::numeric, 0);

    SELECT pv.sell_price, pv.cost_price, p.name, pv.sku
      INTO v_sell_price, v_cost_price, v_product_name, v_sku
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id;

    SELECT pt.price INTO v_effective_price
    FROM public.price_tiers pt
    WHERE pt.variant_id = v_variant_id AND pt.min_qty <= v_qty
    ORDER BY pt.min_qty DESC
    LIMIT 1;
    IF NOT FOUND OR v_effective_price IS NULL THEN
      v_effective_price := v_sell_price;
    END IF;

    v_line_total := v_qty * v_effective_price;

    INSERT INTO public.sale_items (
      sale_id, variant_id, product_name, sku, qty,
      unit_price, cost_price, discount, subtotal
    ) VALUES (
      v_sale_id, v_variant_id, v_product_name, v_sku, v_qty,
      v_effective_price, v_cost_price, v_discount, v_line_total - v_discount
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

  IF v_is_credit AND v_receivable > 0 THEN
    UPDATE public.customers
    SET receivable_balance = receivable_balance + v_receivable, updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  RETURN public.build_sale_receipt(v_sale_id);
END;
$$;

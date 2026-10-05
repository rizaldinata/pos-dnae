-- Sub-PRD 1.4: RPC checkout atomik (PRD 5.5, kriteria checkout).
--
-- Menulis sale + items + payments + pengurangan stok + stock_movements
-- dalam SATU transaksi. Harga dan snapshot diambil dari database
-- (tidak percaya harga dari klien); hanya diskon per item yang diterima
-- dari klien dan divalidasi ulang.
--
-- Payload (jsonb):
-- {
--   "idempotency_key": "uuid",
--   "user_id": "uuid",
--   "shift_id": "uuid | null",
--   "customer_id": "uuid | null",
--   "allow_negative_stock": false,
--   "tax_total": 0, "service_fee": 0, "rounding": 0,
--   "items": [{ "variant_id": "uuid", "qty": 2, "discount": 350 }],
--   "payments": [{ "payment_method_id": "uuid", "amount": 7000, "reference_no": null }]
-- }
--
-- Return: receipt lengkap sebagai jsonb { sale, items, payments }.
-- Error (RAISE EXCEPTION, prefix kode):
--   FORBIDDEN:... | IDEMPOTENCY_KEY_REQUIRED | ITEMS_REQUIRED | PAYMENTS_REQUIRED
--   VARIANT_NOT_FOUND:... | INSUFFICIENT_STOCK:SKU | UNDERPAID | INVALID_PAYMENT_METHOD:...

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
  v_tax_total numeric(15,2) := COALESCE((p_payload->>'tax_total')::numeric, 0);
  v_service_fee numeric(15,2) := COALESCE((p_payload->>'service_fee')::numeric, 0);
  v_rounding numeric(15,2) := COALESCE((p_payload->>'rounding')::numeric, 0);
  v_existing_id uuid;
  v_sale_id uuid;
  v_invoice_no text;
  v_subtotal numeric(15,2) := 0;
  v_discount_total numeric(15,2) := 0;
  v_grand_total numeric(15,2);
  v_paid_total numeric(15,2) := 0;
  v_change numeric(15,2);
  v_item jsonb;
  v_payment jsonb;
  v_variant_id uuid;
  v_qty numeric(15,3);
  v_discount numeric(15,2);
  v_sell_price numeric(15,2);
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
  -- Hanya kasir dengan permission yang boleh checkout.
  IF NOT public.has_permission('sale.create') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing sale.create permission';
  END IF;

  IF v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'ITEMS_REQUIRED';
  END IF;

  IF jsonb_typeof(p_payload->'payments') <> 'array' OR jsonb_array_length(p_payload->'payments') = 0 THEN
    RAISE EXCEPTION 'PAYMENTS_REQUIRED';
  END IF;

  -- Idempotency: kembalikan struk yang sudah ada.
  SELECT id INTO v_existing_id FROM public.sales WHERE idempotency_key = v_idempotency_key;
  IF v_existing_id IS NOT NULL THEN
    RETURN public.build_sale_receipt(v_existing_id);
  END IF;

  -- Validasi item + hitung ulang total dari harga database.
  -- Kunci baris stok berurutan (ORDER BY) untuk mencegah deadlock.
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

    v_line_total := v_qty * v_sell_price;
    IF v_discount > v_line_total THEN
      RAISE EXCEPTION 'INVALID_DISCOUNT:%', v_variant_id;
    END IF;

    v_subtotal := v_subtotal + v_line_total;
    v_discount_total := v_discount_total + v_discount;
  END LOOP;

  v_grand_total := v_subtotal - v_discount_total + v_tax_total + v_service_fee + v_rounding;
  IF v_grand_total < 0 THEN
    RAISE EXCEPTION 'INVALID_TOTAL';
  END IF;

  -- Validasi pembayaran.
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

  IF v_paid_total < v_grand_total THEN
    RAISE EXCEPTION 'UNDERPAID:paid % < total %', v_paid_total, v_grand_total;
  END IF;
  v_change := v_paid_total - v_grand_total;

  -- Nomor invoice atomik.
  v_invoice_no := 'INV-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD')
    || '-' || lpad(public.next_number('invoice')::text, 4, '0');

  INSERT INTO public.sales (
    invoice_no, idempotency_key, shift_id, user_id, customer_id,
    subtotal, discount_total, tax_total, service_fee, rounding,
    grand_total, paid_total, change_amount, status
  ) VALUES (
    v_invoice_no, v_idempotency_key, v_shift_id, v_user_id, v_customer_id,
    v_subtotal, v_discount_total, v_tax_total, v_service_fee, v_rounding,
    v_grand_total, v_paid_total, v_change, 'completed'
  ) RETURNING id INTO v_sale_id;

  -- Tulis item + kurangi stok + catat pergerakan.
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

    v_line_total := v_qty * v_sell_price;

    INSERT INTO public.sale_items (
      sale_id, variant_id, product_name, sku, qty,
      unit_price, cost_price, discount, subtotal
    ) VALUES (
      v_sale_id, v_variant_id, v_product_name, v_sku, v_qty,
      v_sell_price, v_cost_price, v_discount, v_line_total - v_discount
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

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payload->'payments') LOOP
    v_payment_method_id := (v_payment->>'payment_method_id')::uuid;
    v_amount := (v_payment->>'amount')::numeric;
    v_reference_no := NULLIF(v_payment->>'reference_no', '');

    INSERT INTO public.sale_payments (sale_id, payment_method_id, amount, reference_no)
    VALUES (v_sale_id, v_payment_method_id, v_amount, v_reference_no);
  END LOOP;

  RETURN public.build_sale_receipt(v_sale_id);
END;
$$;

-- Penyusun JSON struk (dipakai create_sale dan dibaca ulang untuk cetak ulang).
CREATE OR REPLACE FUNCTION public.build_sale_receipt(p_sale_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'sale', to_jsonb(s),
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(si) ORDER BY si.created_at)
      FROM public.sale_items si WHERE si.sale_id = s.id
    ), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sp.id,
        'payment_method_id', sp.payment_method_id,
        'payment_method_name', pm.name,
        'payment_method_type', pm.type,
        'amount', sp.amount,
        'reference_no', sp.reference_no
      ) ORDER BY sp.created_at)
      FROM public.sale_payments sp
      LEFT JOIN public.payment_methods pm ON pm.id = sp.payment_method_id
      WHERE sp.sale_id = s.id
    ), '[]'::jsonb)
  )
  FROM public.sales s
  WHERE s.id = p_sale_id;
$$;

GRANT EXECUTE ON FUNCTION public.create_sale(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.build_sale_receipt(uuid) TO authenticated;

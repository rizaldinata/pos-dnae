-- Sub-PRD 4.1: penerimaan barang mencatat batch & tanggal kedaluwarsa (INV-06).
--
-- receive_goods (versi baru): bila item punya batch_no / expiry_date,
-- dibuat baris stock_batches (qty penerimaan) dan stock_movements
-- terhubung ke batch_id — modal FEFO & peringatan kedaluwarsa.
-- Penerimaan tanpa batch/ expiry tetap seperti sebelumnya (batch_id NULL).

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
  v_batch_id uuid;
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
    v_batch_id := NULL;

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

    -- Baris batch baru per baris penerimaan; FEFO mengurutkannya per tanggal
    -- kedaluwarsa, jadi batch sama yang diterima bertahap tetap aman.
    IF v_batch_no <> '' OR v_expiry IS NOT NULL THEN
      INSERT INTO public.stock_batches (variant_id, batch_no, qty, expiry_date)
      VALUES (v_variant_id, v_batch_no, v_qty, v_expiry)
      RETURNING id INTO v_batch_id;
    END IF;

    UPDATE public.stocks SET qty = qty + v_qty, updated_at = now()
    WHERE variant_id = v_variant_id
    RETURNING qty INTO v_stock_qty;

    INSERT INTO public.stock_movements (
      variant_id, batch_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
    ) VALUES (
      v_variant_id, v_batch_id, 'purchase', v_qty, v_stock_qty,
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

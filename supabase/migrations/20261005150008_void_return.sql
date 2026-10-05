-- Sub-PRD 2.2: RPC void & retur penjualan (PRD POS-17, POS-18).
-- void_sale    : batal penuh, stok kembali (movement type 'void'), audit.
-- create_return: retur parsial per item, stok kembali ('return_in'),
--                status sale -> partial_return / returned, audit.

CREATE OR REPLACE FUNCTION public.void_sale(p_sale_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_item record;
  v_stock_qty numeric(15,3);
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.has_permission('sale.void') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing sale.void permission';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'VOID_REASON_REQUIRED';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALE_NOT_FOUND:%', p_sale_id;
  END IF;

  IF v_sale.status = 'void' THEN
    RAISE EXCEPTION 'SALE_ALREADY_VOID:%', p_sale_id;
  END IF;

  IF v_sale.status NOT IN ('completed', 'partial_return') THEN
    RAISE EXCEPTION 'SALE_NOT_VOIDABLE:%', v_sale.status;
  END IF;

  -- Kembalikan stok per item (berurutan anti-deadlock).
  FOR v_item IN
    SELECT si.variant_id, si.qty, si.sku
    FROM public.sale_items si
    WHERE si.sale_id = p_sale_id AND si.variant_id IS NOT NULL
    ORDER BY si.variant_id
  LOOP
    UPDATE public.stocks SET qty = qty + v_item.qty
    WHERE variant_id = v_item.variant_id
    RETURNING qty INTO v_stock_qty;

    INSERT INTO public.stock_movements (
      variant_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
    ) VALUES (
      v_item.variant_id, 'void', v_item.qty, v_stock_qty,
      'sale', p_sale_id, 'Void ' || v_sale.invoice_no || ': ' || v_reason, auth.uid()
    );
  END LOOP;

  UPDATE public.sales
  SET status = 'void',
      voided_by = auth.uid(),
      void_reason = v_reason,
      updated_at = now()
  WHERE id = p_sale_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
  VALUES (
    auth.uid(), 'sale.void', 'sales', p_sale_id::text,
    jsonb_build_object('invoice_no', v_sale.invoice_no, 'reason', v_reason)
  );

  RETURN public.build_sale_receipt(p_sale_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_return(
  p_sale_id uuid,
  p_items jsonb,
  p_refund_method_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_return_id uuid;
  v_total_refund numeric(15,2) := 0;
  v_entry jsonb;
  v_sale_item_id uuid;
  v_qty numeric(15,3);
  v_si record;
  v_returned_so_far numeric(15,3);
  v_refund numeric(15,2);
  v_stock_qty numeric(15,3);
  v_method_active boolean;
  v_all_returned boolean := TRUE;
  v_any_returned boolean := FALSE;
  v_item record;
BEGIN
  IF NOT public.has_permission('sale.return') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing sale.return permission';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'RETURN_REASON_REQUIRED';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'RETURN_ITEMS_REQUIRED';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALE_NOT_FOUND:%', p_sale_id;
  END IF;

  IF v_sale.status NOT IN ('completed', 'partial_return') THEN
    RAISE EXCEPTION 'SALE_NOT_RETURNABLE:%', v_sale.status;
  END IF;

  SELECT is_active INTO v_method_active
  FROM public.payment_methods
  WHERE id = p_refund_method_id AND deleted_at IS NULL;
  IF NOT FOUND OR NOT v_method_active THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD:%', p_refund_method_id;
  END IF;

  INSERT INTO public.sale_returns (sale_id, reason, total_refund, refund_method_id, approved_by, created_by)
  VALUES (p_sale_id, v_reason, 0, p_refund_method_id, auth.uid(), auth.uid())
  RETURNING id INTO v_return_id;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_sale_item_id := (v_entry->>'sale_item_id')::uuid;
    v_qty := (v_entry->>'qty')::numeric;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_RETURN_QTY:%', v_sale_item_id;
    END IF;

    SELECT si.* INTO v_si
    FROM public.sale_items si
    WHERE si.id = v_sale_item_id AND si.sale_id = p_sale_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SALE_ITEM_NOT_FOUND:%', v_sale_item_id;
    END IF;

    SELECT COALESCE(sum(sri.qty), 0) INTO v_returned_so_far
    FROM public.sale_return_items sri
    JOIN public.sale_returns sr ON sr.id = sri.return_id
    WHERE sri.sale_item_id = v_sale_item_id;

    IF v_returned_so_far + v_qty > v_si.qty THEN
      RAISE EXCEPTION 'RETURN_QTY_EXCEEDS_SOLD:%', v_sale_item_id;
    END IF;

    -- Refund proporsional terhadap subtotal item (termasuk diskon).
    v_refund := round((v_si.subtotal / v_si.qty) * v_qty, 2);

    INSERT INTO public.sale_return_items (return_id, sale_item_id, qty, refund_amount)
    VALUES (v_return_id, v_sale_item_id, v_qty, v_refund);

    v_total_refund := v_total_refund + v_refund;
    v_any_returned := TRUE;

    -- Kembalikan stok bila varian dilacak.
    IF v_si.variant_id IS NOT NULL THEN
      UPDATE public.stocks SET qty = qty + v_qty
      WHERE variant_id = v_si.variant_id
      RETURNING qty INTO v_stock_qty;

      INSERT INTO public.stock_movements (
        variant_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
      ) VALUES (
        v_si.variant_id, 'return_in', v_qty, v_stock_qty,
        'sale_return', v_return_id,
        'Retur ' || v_sale.invoice_no || ': ' || v_reason, auth.uid()
      );
    END IF;
  END LOOP;

  IF NOT v_any_returned THEN
    RAISE EXCEPTION 'RETURN_ITEMS_REQUIRED';
  END IF;

  UPDATE public.sale_returns SET total_refund = v_total_refund WHERE id = v_return_id;

  -- Tentukan status: semua item full diretur -> returned, else partial_return.
  FOR v_item IN SELECT id, qty FROM public.sale_items WHERE sale_id = p_sale_id LOOP
    SELECT COALESCE(sum(sri.qty), 0) INTO v_returned_so_far
    FROM public.sale_return_items sri
    JOIN public.sale_returns sr ON sr.id = sri.return_id
    WHERE sri.sale_item_id = v_item.id;
    IF v_returned_so_far < v_item.qty THEN
      v_all_returned := FALSE;
    END IF;
  END LOOP;

  UPDATE public.sales
  SET status = CASE WHEN v_all_returned THEN 'returned' ELSE 'partial_return' END,
      updated_at = now()
  WHERE id = p_sale_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
  VALUES (
    auth.uid(), 'sale.return', 'sale_returns', v_return_id::text,
    jsonb_build_object('sale_id', p_sale_id, 'invoice_no', v_sale.invoice_no,
                       'total_refund', v_total_refund, 'reason', v_reason)
  );

  RETURN jsonb_build_object(
    'return', to_jsonb((SELECT r FROM public.sale_returns r WHERE r.id = v_return_id)),
    'total_refund', v_total_refund,
    'receipt', public.build_sale_receipt(p_sale_id)
  );
END;
$$;

-- Struk menyertakan qty yang sudah diretur per item (untuk validasi & UI).
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
      SELECT jsonb_agg(
        to_jsonb(si)
        || jsonb_build_object(
          'returned_qty',
          COALESCE((
            SELECT sum(sri.qty)
            FROM public.sale_return_items sri
            JOIN public.sale_returns sr ON sr.id = sri.return_id
            WHERE sri.sale_item_id = si.id
          ), 0)
        )
        ORDER BY si.created_at)
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

GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_return(uuid, jsonb, uuid, text) TO authenticated;

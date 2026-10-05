-- Sub-PRD 2.3: RPC penyesuaian stok & approve opname (PRD INV-03, INV-04).
-- adjust_stock        : set stok ke qty baru (terkunci), movement 'adjust', audit.
-- approve_stock_opname: terapkan selisih opname yang != 0, movement 'opname', audit.

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_variant_id uuid,
  p_new_qty numeric,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_old numeric(15,3);
  v_diff numeric(15,3);
  v_movement_id uuid;
BEGIN
  IF NOT public.has_permission('stock.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing stock.manage permission';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'ADJUST_REASON_REQUIRED';
  END IF;

  IF p_new_qty IS NULL OR p_new_qty < 0 THEN
    RAISE EXCEPTION 'INVALID_NEW_QTY';
  END IF;

  SELECT qty INTO v_old
  FROM public.stocks
  WHERE variant_id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_NOT_FOUND:%', p_variant_id;
  END IF;

  v_diff := p_new_qty - v_old;

  IF v_diff = 0 THEN
    RETURN jsonb_build_object(
      'variant_id', p_variant_id, 'old_qty', v_old,
      'new_qty', v_old, 'movement_id', NULL
    );
  END IF;

  UPDATE public.stocks SET qty = p_new_qty, updated_at = now()
  WHERE variant_id = p_variant_id;

  INSERT INTO public.stock_movements (
    variant_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
  ) VALUES (
    p_variant_id, 'adjust', v_diff, p_new_qty, 'adjust', NULL, v_reason, auth.uid()
  ) RETURNING id INTO v_movement_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
  VALUES (
    auth.uid(), 'stock.adjust', 'stocks', p_variant_id::text,
    jsonb_build_object('old_qty', v_old, 'new_qty', p_new_qty, 'reason', v_reason)
  );

  RETURN jsonb_build_object(
    'variant_id', p_variant_id, 'old_qty', v_old,
    'new_qty', p_new_qty, 'movement_id', v_movement_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_stock_opname(p_opname_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opname public.stock_opnames%ROWTYPE;
  v_item record;
  v_stock_qty numeric(15,3);
  v_adjusted int := 0;
BEGIN
  IF NOT public.has_permission('opname.approve') THEN
    RAISE EXCEPTION 'FORBIDDEN:missing opname.approve permission';
  END IF;

  SELECT * INTO v_opname FROM public.stock_opnames WHERE id = p_opname_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPNAME_NOT_FOUND:%', p_opname_id;
  END IF;

  IF v_opname.status = 'approved' THEN
    RAISE EXCEPTION 'OPNAME_ALREADY_APPROVED:%', p_opname_id;
  END IF;

  FOR v_item IN
    SELECT * FROM public.stock_opname_items
    WHERE opname_id = p_opname_id AND diff <> 0
    ORDER BY variant_id
  LOOP
    SELECT qty INTO v_stock_qty
    FROM public.stocks
    WHERE variant_id = v_item.variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'STOCK_NOT_FOUND:%', v_item.variant_id;
    END IF;

    UPDATE public.stocks SET qty = v_item.actual_qty, updated_at = now()
    WHERE variant_id = v_item.variant_id;

    INSERT INTO public.stock_movements (
      variant_id, type, qty_change, balance_after, ref_type, ref_id, note, created_by
    ) VALUES (
      v_item.variant_id, 'opname', v_item.diff, v_item.actual_qty,
      'opname', p_opname_id,
      'Opname ' || v_opname.code, auth.uid()
    );

    v_adjusted := v_adjusted + 1;
  END LOOP;

  UPDATE public.stock_opnames
  SET status = 'approved', approved_by = auth.uid(), updated_at = now()
  WHERE id = p_opname_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
  VALUES (
    auth.uid(), 'stock.opname_approve', 'stock_opnames', p_opname_id::text,
    jsonb_build_object('code', v_opname.code, 'adjusted_items', v_adjusted)
  );

  RETURN jsonb_build_object(
    'opname_id', p_opname_id, 'code', v_opname.code, 'adjusted_items', v_adjusted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_stock_opname(uuid) TO authenticated;

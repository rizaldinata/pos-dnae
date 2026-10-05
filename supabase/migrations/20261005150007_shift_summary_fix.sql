-- Sub-PRD 2.1 (perbaikan): shift_summary memperhitungkan kembalian tunai.
-- Rumus: modal + terima tunai + masuk - keluar - kembalian - refund tunai.

CREATE OR REPLACE FUNCTION public.shift_summary(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_cash_sales numeric(15,2);
  v_change_given numeric(15,2);
  v_cash_in numeric(15,2);
  v_cash_out numeric(15,2);
  v_refunds_cash numeric(15,2);
  v_expected numeric(15,2);
  v_by_method jsonb;
  v_transactions bigint;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIFT_NOT_FOUND:%', p_shift_id;
  END IF;

  IF auth.uid() <> v_shift.user_id
    AND NOT public.has_permission('shift.manage')
    AND NOT public.has_permission('report.view')
  THEN
    RAISE EXCEPTION 'FORBIDDEN:shift summary';
  END IF;

  SELECT COALESCE(sum(sp.amount), 0)
    INTO v_cash_sales
  FROM public.sale_payments sp
  JOIN public.sales s ON s.id = sp.sale_id
  JOIN public.payment_methods pm ON pm.id = sp.payment_method_id
  WHERE s.shift_id = p_shift_id
    AND s.status NOT IN ('void', 'held')
    AND pm.type = 'cash';

  -- Kembalian tunai yang keluar dari laci.
  SELECT COALESCE(sum(s.change_amount), 0)
    INTO v_change_given
  FROM public.sales s
  WHERE s.shift_id = p_shift_id
    AND s.status NOT IN ('void', 'held');

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'method_name', t.method_name,
      'method_type', t.method_type,
      'transactions', t.transactions,
      'total', t.total
    ) ORDER BY t.total DESC), '[]'::jsonb)
    INTO v_by_method
  FROM (
    SELECT pm.name AS method_name, pm.type AS method_type,
           count(DISTINCT s.id)::bigint AS transactions,
           sum(sp.amount) AS total
    FROM public.sale_payments sp
    JOIN public.sales s ON s.id = sp.sale_id
    JOIN public.payment_methods pm ON pm.id = sp.payment_method_id
    WHERE s.shift_id = p_shift_id
      AND s.status NOT IN ('void', 'held')
    GROUP BY pm.name, pm.type
  ) t;

  SELECT COALESCE(sum(amount) FILTER (WHERE type = 'in'), 0),
         COALESCE(sum(amount) FILTER (WHERE type = 'out'), 0)
    INTO v_cash_in, v_cash_out
  FROM public.cash_movements
  WHERE shift_id = p_shift_id;

  SELECT COALESCE(sum(sr.total_refund), 0)
    INTO v_refunds_cash
  FROM public.sale_returns sr
  JOIN public.sales s ON s.id = sr.sale_id
  JOIN public.payment_methods pm ON pm.id = sr.refund_method_id
  WHERE s.shift_id = p_shift_id
    AND s.status NOT IN ('void', 'held')
    AND pm.type = 'cash';

  SELECT count(*)::bigint INTO v_transactions
  FROM public.sales
  WHERE shift_id = p_shift_id AND status NOT IN ('void', 'held');

  v_expected := v_shift.opening_cash + v_cash_sales + v_cash_in - v_cash_out - v_change_given - v_refunds_cash;

  RETURN jsonb_build_object(
    'shift', to_jsonb(v_shift),
    'transactions', v_transactions,
    'cash_sales', v_cash_sales,
    'cash_in', v_cash_in,
    'cash_out', v_cash_out,
    'change_given', v_change_given,
    'refunds_cash', v_refunds_cash,
    'expected_cash', v_expected,
    'by_method', v_by_method
  );
END;
$$;


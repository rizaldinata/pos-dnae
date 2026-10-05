-- Sub-PRD 2.1: RPC shift kasir (PRD 3.3).
-- open_shift  : buka shift baru (1 aktif per user, pemilik = auth.uid()).
-- close_shift : tutup shift + hitung selisih (pemilik atau shift.manage).
-- shift_summary: rekap shift (untuk halaman rekap & dialog tutup).
--
-- Rumus kas ekspektasi:
--   modal awal + penjualan tunai + kas masuk - kas keluar - refund tunai.

-- Kasir boleh mencatat kas masuk/keluar pada shift miliknya yang terbuka.
CREATE POLICY "cash_movements_insert_own_open_shift"
  ON public.cash_movements FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.id = shift_id
        AND s.user_id = auth.uid()
        AND s.status = 'open'
    )
  );

CREATE OR REPLACE FUNCTION public.open_shift(p_opening_cash numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing uuid;
  v_shift jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN:not authenticated';
  END IF;

  IF p_opening_cash IS NULL OR p_opening_cash < 0 THEN
    RAISE EXCEPTION 'INVALID_OPENING_CASH';
  END IF;

  SELECT id INTO v_existing
  FROM public.shifts
  WHERE user_id = v_user_id AND status = 'open'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'SHIFT_ALREADY_OPEN:%', v_existing;
  END IF;

  INSERT INTO public.shifts (user_id, opening_cash, status)
  VALUES (v_user_id, p_opening_cash, 'open')
  RETURNING to_jsonb(shifts.*) INTO v_shift;

  RETURN v_shift;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.close_shift(
  p_shift_id uuid,
  p_closing_cash numeric,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_summary jsonb;
  v_expected numeric(15,2);
  v_difference numeric(15,2);
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIFT_NOT_FOUND:%', p_shift_id;
  END IF;

  IF v_shift.status <> 'open' THEN
    RAISE EXCEPTION 'SHIFT_ALREADY_CLOSED:%', p_shift_id;
  END IF;

  IF auth.uid() <> v_shift.user_id AND NOT public.has_permission('shift.manage') THEN
    RAISE EXCEPTION 'FORBIDDEN:close shift';
  END IF;

  IF p_closing_cash IS NULL OR p_closing_cash < 0 THEN
    RAISE EXCEPTION 'INVALID_CLOSING_CASH';
  END IF;

  v_summary := public.shift_summary(p_shift_id);
  v_expected := (v_summary->>'expected_cash')::numeric;
  v_difference := p_closing_cash - v_expected;

  UPDATE public.shifts
  SET closed_at = now(),
      expected_cash = v_expected,
      closing_cash = p_closing_cash,
      difference = v_difference,
      updated_at = now(),
      status = 'closed'
  WHERE id = p_shift_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_value)
  VALUES (
    auth.uid(),
    'shift.close',
    'shifts',
    p_shift_id::text,
    jsonb_build_object(
      'closing_cash', p_closing_cash,
      'expected_cash', v_expected,
      'difference', v_difference,
      'note', NULLIF(btrim(COALESCE(p_note, '')), '')
    )
  );

  RETURN public.shift_summary(p_shift_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_shift(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shift_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_shift(uuid, numeric, text) TO authenticated;

-- Sub-PRD 3.5: keuangan & laba rugi (FIN-01/02/03, Bagian 6.5).
-- expense_categories, expenses;
-- cash_flow_report      — kas masuk/keluar (FIN-02), dihitung di database;
-- profit_loss_report    — penjualan - HPP - pengeluaran (FIN-03);
-- profit_loss_monthly   — tren laba per bulan untuk grafik;
-- expense_summary       — pengeluaran per kategori.

CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.expense_categories (id) ON DELETE RESTRICT,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  note text NOT NULL DEFAULT '',
  expense_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX idx_expenses_expense_date ON public.expenses (expense_date DESC);
CREATE INDEX idx_expenses_category_id ON public.expenses (category_id);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_categories_select_viewer"
  ON public.expense_categories FOR SELECT TO authenticated
  USING (
    public.has_permission('report.view')
    OR public.has_permission('finance.manage')
    OR public.has_permission('report.profit.view')
  );
CREATE POLICY "expense_categories_manage_finance_manager"
  ON public.expense_categories FOR ALL TO authenticated
  USING (public.has_permission('finance.manage'))
  WITH CHECK (public.has_permission('finance.manage'));

CREATE POLICY "expenses_select_viewer"
  ON public.expenses FOR SELECT TO authenticated
  USING (
    public.has_permission('report.view')
    OR public.has_permission('finance.manage')
    OR public.has_permission('report.profit.view')
  );
CREATE POLICY "expenses_manage_finance_manager"
  ON public.expenses FOR ALL TO authenticated
  USING (public.has_permission('finance.manage'))
  WITH CHECK (public.has_permission('finance.manage'));

-- ============ LAPORAN (dihitung di database, FIN-02/03) ============

-- Arus kas: kas masuk (penjualan tunai, kas masuk shift, pembayaran piutang)
-- dikurangi kas keluar (pengeluaran, kas keluar shift, refund tunai,
-- pembayaran hutang). Dikembalikan per sumber; saldo = total masuk - keluar.
CREATE OR REPLACE FUNCTION public.cash_flow_report(p_from date, p_to date)
RETURNS TABLE (
  flow_direction text,
  flow_source text,
  flow_label text,
  entries bigint,
  total numeric(15,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_from date := LEAST(p_from, p_to);
  v_to date := GREATEST(p_from, p_to);
BEGIN
  IF NOT (public.has_permission('report.view') OR public.has_permission('finance.manage')) THEN
    RAISE EXCEPTION 'FORBIDDEN:missing report.view permission';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT 'in'::text AS flow_direction,
           'sale_cash'::text AS flow_source,
           'Penjualan tunai'::text AS flow_label,
           count(*)::bigint AS entries,
           COALESCE(sum(sp.amount), 0)::numeric(15,2) AS total
    FROM public.sale_payments sp
    JOIN public.sales s ON s.id = sp.sale_id
    JOIN public.payment_methods pm ON pm.id = sp.payment_method_id
    WHERE pm.type = 'cash'
      AND s.status NOT IN ('void', 'held')
      AND (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    UNION ALL
    SELECT 'in', 'shift_in', 'Kas masuk shift',
           count(*)::bigint, COALESCE(sum(cm.amount), 0)::numeric(15,2)
    FROM public.cash_movements cm
    WHERE cm.type = 'in'
      AND (cm.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    UNION ALL
    SELECT 'in', 'receivable', 'Pembayaran piutang',
           count(*)::bigint, COALESCE(sum(rp.amount), 0)::numeric(15,2)
    FROM public.receivable_payments rp
    WHERE (rp.paid_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    UNION ALL
    SELECT 'out', 'expense', 'Pengeluaran operasional',
           count(*)::bigint, COALESCE(sum(e.amount), 0)::numeric(15,2)
    FROM public.expenses e
    WHERE e.expense_date BETWEEN v_from AND v_to
    UNION ALL
    SELECT 'out', 'shift_out', 'Kas keluar shift',
           count(*)::bigint, COALESCE(sum(cm.amount), 0)::numeric(15,2)
    FROM public.cash_movements cm
    WHERE cm.type = 'out'
      AND (cm.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    UNION ALL
    SELECT 'out', 'refund', 'Refund tunai',
           count(*)::bigint, COALESCE(sum(sr.total_refund), 0)::numeric(15,2)
    FROM public.sale_returns sr
    LEFT JOIN public.payment_methods pm ON pm.id = sr.refund_method_id
    WHERE COALESCE(pm.type, 'cash') = 'cash'
      AND (sr.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    UNION ALL
    SELECT 'out', 'supplier', 'Pembayaran hutang',
           count(*)::bigint, COALESCE(sum(sup.amount), 0)::numeric(15,2)
    FROM public.supplier_payments sup
    WHERE (sup.paid_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
  ) AS flows
  WHERE flows.entries > 0
  ORDER BY flows.flow_direction, flows.flow_source;
END;
$$;

-- Laba rugi sederhana: penjualan bruto - diskon = neto; HPP dari snapshot
-- cost_price × qty pada sale_items; laba bersih = laba kotor - pengeluaran.
CREATE OR REPLACE FUNCTION public.profit_loss_report(p_from date, p_to date)
RETURNS TABLE (
  gross_sales numeric(15,2),
  discount_total numeric(15,2),
  net_sales numeric(15,2),
  cogs numeric(15,2),
  gross_profit numeric(15,2),
  expense_total numeric(15,2),
  net_profit numeric(15,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_from date := LEAST(p_from, p_to);
  v_to date := GREATEST(p_from, p_to);
BEGIN
  IF NOT (public.has_permission('report.profit.view') OR public.has_permission('finance.manage')) THEN
    RAISE EXCEPTION 'FORBIDDEN:missing report.profit.view permission';
  END IF;

  RETURN QUERY
  SELECT
    sales_agg.g,
    sales_agg.d,
    sales_agg.n,
    hpp_agg.h,
    (sales_agg.n - hpp_agg.h)::numeric(15,2),
    exp_agg.x,
    (sales_agg.n - hpp_agg.h - exp_agg.x)::numeric(15,2)
  FROM (
    SELECT COALESCE(sum(s.subtotal), 0)::numeric(15,2) AS g,
           COALESCE(sum(s.discount_total), 0)::numeric(15,2) AS d,
           COALESCE(sum(s.subtotal - s.discount_total), 0)::numeric(15,2) AS n
    FROM public.sales s
    WHERE s.status NOT IN ('void', 'held')
      AND (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
  ) AS sales_agg,
  (
    SELECT COALESCE(sum(si.cost_price * si.qty), 0)::numeric(15,2) AS h
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE s.status NOT IN ('void', 'held')
      AND (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
  ) AS hpp_agg,
  (
    SELECT COALESCE(sum(e.amount), 0)::numeric(15,2) AS x
    FROM public.expenses e
    WHERE e.expense_date BETWEEN v_from AND v_to
  ) AS exp_agg;
END;
$$;

-- Pengeluaran operasional per kategori (untuk rincian laba rugi).
CREATE OR REPLACE FUNCTION public.expense_summary(p_from date, p_to date)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  entries bigint,
  total numeric(15,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_from date := LEAST(p_from, p_to);
  v_to date := GREATEST(p_from, p_to);
BEGIN
  IF NOT (public.has_permission('report.profit.view') OR public.has_permission('finance.manage')) THEN
    RAISE EXCEPTION 'FORBIDDEN:missing report.profit.view permission';
  END IF;

  RETURN QUERY
  SELECT ec.id, ec.name, count(*)::bigint, COALESCE(sum(e.amount), 0)::numeric(15,2)
  FROM public.expenses e
  JOIN public.expense_categories ec ON ec.id = e.category_id
  WHERE e.expense_date BETWEEN v_from AND v_to
  GROUP BY ec.id, ec.name
  ORDER BY COALESCE(sum(e.amount), 0) DESC, ec.name;
END;
$$;

-- Tren laba per bulan (maksimal 36 bulan terakhir) untuk grafik.
CREATE OR REPLACE FUNCTION public.profit_loss_monthly(p_from date, p_to date)
RETURNS TABLE (
  month_start date,
  net_sales numeric(15,2),
  cogs numeric(15,2),
  expense_total numeric(15,2),
  net_profit numeric(15,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_from date := LEAST(p_from, p_to);
  v_to date := GREATEST(p_from, p_to);
BEGIN
  IF NOT (public.has_permission('report.profit.view') OR public.has_permission('finance.manage')) THEN
    RAISE EXCEPTION 'FORBIDDEN:missing report.profit.view permission';
  END IF;

  v_from := GREATEST(v_from, (v_to - (interval '35 months'))::date);

  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', v_from::timestamp),
      date_trunc('month', v_to::timestamp),
      interval '1 month'
    )::date AS m
  ),
  sales_by_month AS (
    SELECT date_trunc('month', s.created_at AT TIME ZONE 'Asia/Jakarta')::date AS m,
           COALESCE(sum(s.subtotal - s.discount_total), 0)::numeric(15,2) AS n
    FROM public.sales s
    WHERE s.status NOT IN ('void', 'held')
      AND (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    GROUP BY 1
  ),
  cogs_by_month AS (
    SELECT date_trunc('month', s.created_at AT TIME ZONE 'Asia/Jakarta')::date AS m,
           COALESCE(sum(si.cost_price * si.qty), 0)::numeric(15,2) AS h
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE s.status NOT IN ('void', 'held')
      AND (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    GROUP BY 1
  ),
  expenses_by_month AS (
    SELECT date_trunc('month', e.expense_date)::date AS m,
           COALESCE(sum(e.amount), 0)::numeric(15,2) AS x
    FROM public.expenses e
    WHERE e.expense_date BETWEEN v_from AND v_to
    GROUP BY 1
  )
  SELECT ms.m,
         COALESCE(sb.n, 0)::numeric(15,2),
         COALESCE(cb.h, 0)::numeric(15,2),
         COALESCE(eb.x, 0)::numeric(15,2),
         (COALESCE(sb.n, 0) - COALESCE(cb.h, 0) - COALESCE(eb.x, 0))::numeric(15,2)
  FROM months ms
  LEFT JOIN sales_by_month sb ON sb.m = ms.m
  LEFT JOIN cogs_by_month cb ON cb.m = ms.m
  LEFT JOIN expenses_by_month eb ON eb.m = ms.m
  ORDER BY ms.m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cash_flow_report(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profit_loss_report(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expense_summary(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profit_loss_monthly(date, date) TO authenticated;

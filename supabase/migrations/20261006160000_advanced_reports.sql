-- Sub-PRD 3.6: laporan lanjutan (RPT-05).
-- profit_by_product — laba per produk: pendapatan (setelah alokasi diskon
--                     transaksi) - HPP snapshot cost_price × qty;
-- profit_by_period  — laba per hari/minggu/bulan beserta pengeluaran.
-- Keduanya mensyaratkan permission report.profit.view (atau finance.manage).

CREATE OR REPLACE FUNCTION public.profit_by_product(
  p_from date,
  p_to date,
  p_category_id uuid DEFAULT NULL,
  p_sort text DEFAULT 'profit'
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  qty_sold numeric(15,3),
  revenue numeric(15,2),
  cogs numeric(15,2),
  profit numeric(15,2),
  margin_percent numeric(7,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_from date := LEAST(p_from, p_to);
  v_to date := GREATEST(p_from, p_to);
  v_sort text := CASE
    WHEN p_sort IN ('profit', 'margin', 'qty', 'revenue', 'name') THEN p_sort
    ELSE 'profit'
  END;
BEGIN
  IF NOT (public.has_permission('report.profit.view') OR public.has_permission('finance.manage')) THEN
    RAISE EXCEPTION 'FORBIDDEN:missing report.profit.view permission';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT
      calc.product_id,
      calc.product_name,
      calc.qty_sold,
      calc.revenue,
      calc.cogs,
      (calc.revenue - calc.cogs)::numeric(15,2) AS profit,
      CASE
        WHEN calc.revenue > 0
          THEN round(((calc.revenue - calc.cogs) / calc.revenue) * 100, 2)
        ELSE 0::numeric
      END AS margin_percent
    FROM (
      -- Pendapatan per item dialokasikan diskon transaksi secara proporsional
      -- (si.subtotal / s.subtotal) supaya totalnya = penjualan neto - HPP.
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        COALESCE(sum(si.qty), 0)::numeric(15,3) AS qty_sold,
        COALESCE(
          sum(
            si.subtotal
            - COALESCE(s.discount_total, 0)
              * (CASE WHEN s.subtotal > 0 THEN si.subtotal / s.subtotal ELSE 0 END)
          ),
          0
        )::numeric(15,2) AS revenue,
        COALESCE(sum(si.cost_price * si.qty), 0)::numeric(15,2) AS cogs
      FROM public.sale_items si
      JOIN public.sales s ON s.id = si.sale_id
      JOIN public.product_variants pv ON pv.id = si.variant_id
      JOIN public.products p ON p.id = pv.product_id
      WHERE s.status NOT IN ('void', 'held')
        AND (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
        AND (p_category_id IS NULL OR p.id = p_category_id)
      GROUP BY p.id, p.name
    ) AS calc
  ) AS t
  ORDER BY
    CASE WHEN v_sort = 'profit' THEN t.profit END DESC NULLS LAST,
    CASE WHEN v_sort = 'margin' THEN t.margin_percent END DESC NULLS LAST,
    CASE WHEN v_sort = 'qty' THEN t.qty_sold END DESC NULLS LAST,
    CASE WHEN v_sort = 'revenue' THEN t.revenue END DESC NULLS LAST,
    CASE WHEN v_sort = 'name' THEN t.product_name END ASC NULLS LAST,
    t.profit DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.profit_by_period(
  p_from date,
  p_to date,
  p_granularity text DEFAULT 'day'
)
RETURNS TABLE (
  period_start date,
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
  v_grain text := CASE
    WHEN p_granularity IN ('day', 'week', 'month') THEN p_granularity
    ELSE 'day'
  END;
  v_from date := LEAST(p_from, p_to);
  v_to date := GREATEST(p_from, p_to);
BEGIN
  IF NOT (public.has_permission('report.profit.view') OR public.has_permission('finance.manage')) THEN
    RAISE EXCEPTION 'FORBIDDEN:missing report.profit.view permission';
  END IF;

  -- Batasi jumlah bucket (backstop; use case sudah memvalidasi rentang).
  v_from := GREATEST(
    v_from,
    (v_to - CASE v_grain
      WHEN 'day' THEN interval '92 days'
      WHEN 'week' THEN interval '182 days'
      ELSE interval '730 days'
    END)::date
  );

  RETURN QUERY
  WITH buckets AS (
    SELECT generate_series(
      CASE v_grain
        WHEN 'day' THEN date_trunc('day', v_from::timestamp)
        WHEN 'week' THEN date_trunc('week', v_from::timestamp)
        ELSE date_trunc('month', v_from::timestamp)
      END,
      CASE v_grain
        WHEN 'day' THEN date_trunc('day', v_to::timestamp)
        WHEN 'week' THEN date_trunc('week', v_to::timestamp)
        ELSE date_trunc('month', v_to::timestamp)
      END,
      CASE v_grain
        WHEN 'day' THEN interval '1 day'
        WHEN 'week' THEN interval '1 week'
        ELSE interval '1 month'
      END
    )::date AS m
  ),
  sales_by AS (
    SELECT date_trunc(v_grain, s.created_at AT TIME ZONE 'Asia/Jakarta')::date AS m,
           COALESCE(sum(s.subtotal - s.discount_total), 0)::numeric(15,2) AS n
    FROM public.sales s
    WHERE s.status NOT IN ('void', 'held')
      AND (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    GROUP BY 1
  ),
  cogs_by AS (
    SELECT date_trunc(v_grain, s.created_at AT TIME ZONE 'Asia/Jakarta')::date AS m,
           COALESCE(sum(si.cost_price * si.qty), 0)::numeric(15,2) AS h
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE s.status NOT IN ('void', 'held')
      AND (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_from AND v_to
    GROUP BY 1
  ),
  expenses_by AS (
    SELECT date_trunc(v_grain, e.expense_date::timestamp)::date AS m,
           COALESCE(sum(e.amount), 0)::numeric(15,2) AS x
    FROM public.expenses e
    WHERE e.expense_date BETWEEN v_from AND v_to
    GROUP BY 1
  )
  SELECT b.m,
         COALESCE(sb.n, 0)::numeric(15,2),
         COALESCE(cb.h, 0)::numeric(15,2),
         COALESCE(eb.x, 0)::numeric(15,2),
         (COALESCE(sb.n, 0) - COALESCE(cb.h, 0) - COALESCE(eb.x, 0))::numeric(15,2)
  FROM buckets b
  LEFT JOIN sales_by sb ON sb.m = b.m
  LEFT JOIN cogs_by cb ON cb.m = b.m
  LEFT JOIN expenses_by eb ON eb.m = b.m
  ORDER BY b.m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.profit_by_product(date, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profit_by_period(date, date, text) TO authenticated;

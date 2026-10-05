-- Sub-PRD 1.6: fungsi laporan penjualan (PRD RPT-02).
-- Semua agregasi dihitung di database (zona Asia/Jakarta).
-- Transaksi void dan hold dikecualikan dari laporan.

-- Tipe baris laporan per hari (dipakai range & bulanan).
DO $$ BEGIN
  CREATE TYPE public.sales_day_summary AS (
    day date,
    transactions bigint,
    gross_sales numeric(15,2),
    discount_total numeric(15,2),
    net_sales numeric(15,2),
    items_sold numeric
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ringkasan satu hari.
CREATE OR REPLACE FUNCTION public.daily_sales_summary(p_date date)
RETURNS TABLE (
  transactions bigint,
  gross_sales numeric(15,2),
  discount_total numeric(15,2),
  net_sales numeric(15,2),
  items_sold numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    count(DISTINCT s.id)::bigint AS transactions,
    COALESCE(sum(s.subtotal), 0)::numeric(15,2) AS gross_sales,
    COALESCE(sum(s.discount_total), 0)::numeric(15,2) AS discount_total,
    COALESCE(sum(s.grand_total), 0)::numeric(15,2) AS net_sales,
    COALESCE((
      SELECT sum(si.qty)
      FROM public.sale_items si
      JOIN public.sales s2 ON s2.id = si.sale_id
      WHERE (s2.created_at AT TIME ZONE 'Asia/Jakarta')::date = p_date
        AND s2.status NOT IN ('void', 'held')
    ), 0) AS items_sold
  FROM public.sales s
  WHERE (s.created_at AT TIME ZONE 'Asia/Jakarta')::date = p_date
    AND s.status NOT IN ('void', 'held');
$$;

-- Rincian per hari dalam rentang tanggal (inklusif, maksimal 366 hari).
CREATE OR REPLACE FUNCTION public.sales_by_date_range(p_from date, p_to date)
RETURNS SETOF public.sales_day_summary
LANGUAGE sql
STABLE
AS $$
  WITH days AS (
    SELECT generate_series(
      LEAST(p_from, p_to),
      GREATEST(p_from, p_to),
      interval '1 day'
    )::date AS day
  )
  SELECT
    d.day,
    count(DISTINCT s.id)::bigint AS transactions,
    COALESCE(sum(s.subtotal), 0)::numeric(15,2) AS gross_sales,
    COALESCE(sum(s.discount_total), 0)::numeric(15,2) AS discount_total,
    COALESCE(sum(s.grand_total), 0)::numeric(15,2) AS net_sales,
    COALESCE(sum(si.qty), 0) AS items_sold
  FROM days d
  LEFT JOIN public.sales s
    ON (s.created_at AT TIME ZONE 'Asia/Jakarta')::date = d.day
    AND s.status NOT IN ('void', 'held')
  LEFT JOIN public.sale_items si ON si.sale_id = s.id
  WHERE d.day >= LEAST(p_from, p_to) - interval '366 days'
  GROUP BY d.day
  ORDER BY d.day;
$$;

-- Rincian per hari dalam satu bulan.
CREATE OR REPLACE FUNCTION public.monthly_sales_summary(p_year int, p_month int)
RETURNS SETOF public.sales_day_summary
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM public.sales_by_date_range(
    make_date(p_year, p_month, 1),
    (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date
  );
$$;

GRANT EXECUTE ON FUNCTION public.daily_sales_summary(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_by_date_range(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.monthly_sales_summary(int, int) TO authenticated;

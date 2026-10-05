-- Sub-PRD 1.2: view ringkasan stok dengan status dihitung di database.
-- security_invoker = true agar RLS tabel dasar tetap berlaku untuk pemanggil.

CREATE OR REPLACE VIEW public.stock_overview WITH (security_invoker = true) AS
SELECT
  pv.id AS variant_id,
  pv.product_id AS product_id,
  p.name AS product_name,
  pv.variant_name AS variant_name,
  pv.sku AS sku,
  pv.barcode AS barcode,
  p.category_id AS category_id,
  c.name AS category_name,
  pv.min_stock AS min_stock,
  pv.track_stock AS track_stock,
  COALESCE(s.qty, 0) AS qty,
  CASE
    WHEN COALESCE(s.qty, 0) <= 0 THEN 'habis'
    WHEN COALESCE(s.qty, 0) <= pv.min_stock THEN 'menipis'
    ELSE 'normal'
  END AS status
FROM public.product_variants pv
JOIN public.products p ON p.id = pv.product_id AND p.deleted_at IS NULL
LEFT JOIN public.stocks s ON s.variant_id = pv.id
LEFT JOIN public.categories c ON c.id = p.category_id;

COMMENT ON VIEW public.stock_overview IS 'Ringkasan stok per varian dengan status (normal/menipis/habis). Sumber: Sub-PRD 1.2.';

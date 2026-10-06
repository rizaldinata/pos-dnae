-- Sub-PRD 2.6: laporan operasional (RPT-01/03/04) + audit log (SYS-04).
-- Semua fungsi mensyaratkan permission report.view (atau audit.view).

-- Produk terlaris per produk dalam rentang tanggal.
CREATE OR REPLACE FUNCTION public.top_products(p_from date, p_to date, p_limit int DEFAULT 10)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  qty_sold numeric,
  revenue numeric(15,2)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.name, sum(si.qty), sum(si.subtotal)::numeric(15,2)
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  JOIN public.product_variants pv ON pv.id = si.variant_id
  JOIN public.products p ON p.id = pv.product_id
  WHERE (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN LEAST(p_from, p_to) AND GREATEST(p_from, p_to)
    AND s.status NOT IN ('void', 'held')
  GROUP BY p.id, p.name
  ORDER BY sum(si.subtotal) DESC
  LIMIT GREATEST(LEAST(p_limit, 50), 1);
$$;

-- Penjualan per varian (filter kategori opsional).
CREATE OR REPLACE FUNCTION public.sales_by_product(p_from date, p_to date, p_category_id uuid DEFAULT NULL)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  variant_id uuid,
  variant_name text,
  sku text,
  qty_sold numeric,
  revenue numeric(15,2),
  avg_price numeric(15,2)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.name, pv.id, pv.variant_name, pv.sku,
         sum(si.qty),
         sum(si.subtotal)::numeric(15,2),
         CASE WHEN sum(si.qty) > 0 THEN (sum(si.subtotal) / sum(si.qty))::numeric(15,2) ELSE 0 END
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  LEFT JOIN public.product_variants pv ON pv.id = si.variant_id
  LEFT JOIN public.products p ON p.id = pv.product_id
  WHERE (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN LEAST(p_from, p_to) AND GREATEST(p_from, p_to)
    AND s.status NOT IN ('void', 'held')
    AND (p_category_id IS NULL OR p.category_id = p_category_id)
  GROUP BY p.id, p.name, pv.id, pv.variant_name, pv.sku
  ORDER BY sum(si.subtotal) DESC;
$$;

-- Penjualan per kategori (termasuk item tanpa kategori sebagai 'Tanpa kategori').
CREATE OR REPLACE FUNCTION public.sales_by_category(p_from date, p_to date)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  qty_sold numeric,
  revenue numeric(15,2)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT c.id, COALESCE(c.name, 'Tanpa kategori'),
         sum(si.qty), sum(si.subtotal)::numeric(15,2)
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  LEFT JOIN public.product_variants pv ON pv.id = si.variant_id
  LEFT JOIN public.products p ON p.id = pv.product_id
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN LEAST(p_from, p_to) AND GREATEST(p_from, p_to)
    AND s.status NOT IN ('void', 'held')
  GROUP BY c.id, c.name
  ORDER BY sum(si.subtotal) DESC;
$$;

-- Penjualan per kasir.
CREATE OR REPLACE FUNCTION public.sales_by_cashier(p_from date, p_to date)
RETURNS TABLE (
  user_id uuid,
  cashier_name text,
  transactions bigint,
  revenue numeric(15,2),
  avg_per_transaction numeric(15,2)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT s.user_id,
         COALESCE(pr.full_name, left(s.user_id::text, 8)),
         count(*)::bigint,
         sum(s.grand_total)::numeric(15,2),
         CASE WHEN count(*) > 0 THEN (sum(s.grand_total) / count(*))::numeric(15,2) ELSE 0 END
  FROM public.sales s
  LEFT JOIN public.profiles pr ON pr.id = s.user_id
  WHERE (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN LEAST(p_from, p_to) AND GREATEST(p_from, p_to)
    AND s.status NOT IN ('void', 'held')
  GROUP BY s.user_id, pr.full_name
  ORDER BY sum(s.grand_total) DESC;
$$;

-- Penjualan per metode bayar.
CREATE OR REPLACE FUNCTION public.sales_by_payment_method(p_from date, p_to date)
RETURNS TABLE (
  method_name text,
  method_type text,
  transactions bigint,
  total numeric(15,2)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT pm.name, pm.type,
         count(DISTINCT s.id)::bigint,
         sum(sp.amount)::numeric(15,2)
  FROM public.sale_payments sp
  JOIN public.sales s ON s.id = sp.sale_id
  JOIN public.payment_methods pm ON pm.id = sp.payment_method_id
  WHERE (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN LEAST(p_from, p_to) AND GREATEST(p_from, p_to)
    AND s.status NOT IN ('void', 'held')
  GROUP BY pm.name, pm.type
  ORDER BY sum(sp.amount) DESC;
$$;

-- Nilai persediaan per varian + total.
CREATE OR REPLACE FUNCTION public.stock_valuation()
RETURNS TABLE (
  variant_id uuid,
  product_name text,
  variant_name text,
  sku text,
  qty numeric,
  cost_price numeric(15,2),
  stock_value numeric(15,2)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT pv.id, p.name, pv.variant_name, pv.sku,
         COALESCE(s.qty, 0),
         pv.cost_price,
         (COALESCE(s.qty, 0) * pv.cost_price)::numeric(15,2)
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id AND p.deleted_at IS NULL
  LEFT JOIN public.stocks s ON s.variant_id = pv.id
  ORDER BY (COALESCE(s.qty, 0) * pv.cost_price) DESC;
$$;

-- Guard: semua fungsi laporan operasional butuh report.view.
DO $$
DECLARE
  fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'public.top_products(date, date, int)',
    'public.sales_by_product(date, date, uuid)',
    'public.sales_by_category(date, date)',
    'public.sales_by_cashier(date, date)',
    'public.sales_by_payment_method(date, date)',
    'public.stock_valuation()'
  ]) LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- Trigger audit otomatis: perubahan harga & status sensitif.
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_value, new_value)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_product_variants ON public.product_variants;
CREATE TRIGGER trg_audit_product_variants
  AFTER UPDATE OF sell_price, cost_price ON public.product_variants
  FOR EACH ROW
  WHEN (OLD.sell_price IS DISTINCT FROM NEW.sell_price OR OLD.cost_price IS DISTINCT FROM NEW.cost_price)
  EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER UPDATE OF role_id, is_active ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role_id IS DISTINCT FROM NEW.role_id OR OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_payment_methods ON public.payment_methods;
CREATE TRIGGER trg_audit_payment_methods
  AFTER UPDATE OF is_active ON public.payment_methods
  FOR EACH ROW
  WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION public.audit_trigger();

-- Sub-PRD 0.3: RLS dasar (PRD 5.6).
-- Prinsip: RLS aktif di SEMUA tabel; tanpa policy = deny all.
-- Baca role/permission lewat public.has_permission(text).

-- ============ HELPER: cek permission user login ============
-- SECURITY DEFINER agar bisa membaca profiles/role_permissions
-- meskipun RLS aktif. Dibuat di sini (setelah tabel ada) karena
-- function LANGUAGE sql divalidasi saat CREATE.
CREATE OR REPLACE FUNCTION public.has_permission(p_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role_id = p.role_id
    JOIN public.permissions perm ON perm.id = rp.permission_id
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
      AND perm.code = p_code
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO anon;

-- ============ AKTIFKAN RLS ============
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_return_items ENABLE ROW LEVEL SECURITY;

-- ============ ROLES / PERMISSIONS (baca: semua login; tulis: role.manage) ============
CREATE POLICY "roles_select_authenticated"
  ON public.roles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "roles_manage_role_manager"
  ON public.roles FOR ALL TO authenticated
  USING (public.has_permission('role.manage'))
  WITH CHECK (public.has_permission('role.manage'));

CREATE POLICY "permissions_select_authenticated"
  ON public.permissions FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "role_permissions_select_authenticated"
  ON public.role_permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "role_permissions_manage_role_manager"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_permission('role.manage'))
  WITH CHECK (public.has_permission('role.manage'));

-- ============ PROFILES (baca sendiri; kelola: user.manage) ============
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "profiles_select_user_manager"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_permission('user.manage'));
CREATE POLICY "profiles_manage_user_manager"
  ON public.profiles FOR ALL TO authenticated
  USING (public.has_permission('user.manage'))
  WITH CHECK (public.has_permission('user.manage'));

-- ============ AUDIT_LOGS (baca: audit.view; tulis: hanya via service_role/RPC) ============
CREATE POLICY "audit_logs_select_audit_viewer"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_permission('audit.view'));

-- ============ KATALOG (baca: semua login; tulis: product.manage) ============
CREATE POLICY "categories_select_authenticated"
  ON public.categories FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "categories_manage_product_manager"
  ON public.categories FOR ALL TO authenticated
  USING (public.has_permission('product.manage'))
  WITH CHECK (public.has_permission('product.manage'));

CREATE POLICY "brands_select_authenticated"
  ON public.brands FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "brands_manage_product_manager"
  ON public.brands FOR ALL TO authenticated
  USING (public.has_permission('product.manage'))
  WITH CHECK (public.has_permission('product.manage'));

CREATE POLICY "units_select_authenticated"
  ON public.units FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "units_manage_product_manager"
  ON public.units FOR ALL TO authenticated
  USING (public.has_permission('product.manage'))
  WITH CHECK (public.has_permission('product.manage'));

CREATE POLICY "products_select_authenticated"
  ON public.products FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "products_manage_product_manager"
  ON public.products FOR ALL TO authenticated
  USING (public.has_permission('product.manage'))
  WITH CHECK (public.has_permission('product.manage'));

CREATE POLICY "product_variants_select_authenticated"
  ON public.product_variants FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "product_variants_manage_product_manager"
  ON public.product_variants FOR ALL TO authenticated
  USING (public.has_permission('product.manage'))
  WITH CHECK (public.has_permission('product.manage'));

CREATE POLICY "price_tiers_select_authenticated"
  ON public.price_tiers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "price_tiers_manage_product_manager"
  ON public.price_tiers FOR ALL TO authenticated
  USING (public.has_permission('product.manage'))
  WITH CHECK (public.has_permission('product.manage'));

CREATE POLICY "bundle_items_select_authenticated"
  ON public.bundle_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "bundle_items_manage_product_manager"
  ON public.bundle_items FOR ALL TO authenticated
  USING (public.has_permission('product.manage'))
  WITH CHECK (public.has_permission('product.manage'));

-- ============ STOK (baca: semua login; tulis: hanya via RPC/service_role) ============
-- Tidak ada policy INSERT/UPDATE/DELETE = deny; penulisan stok
-- hanya lewat function RPC SECURITY DEFINER (create_sale, receive_goods, ...).
CREATE POLICY "stocks_select_authenticated"
  ON public.stocks FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "stock_batches_select_authenticated"
  ON public.stock_batches FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "stock_movements_select_authenticated"
  ON public.stock_movements FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "stock_opnames_select_authenticated"
  ON public.stock_opnames FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "stock_opnames_manage_stock_manager"
  ON public.stock_opnames FOR ALL TO authenticated
  USING (public.has_permission('stock.manage'))
  WITH CHECK (public.has_permission('stock.manage'));
CREATE POLICY "stock_opname_items_select_authenticated"
  ON public.stock_opname_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "stock_opname_items_manage_stock_manager"
  ON public.stock_opname_items FOR ALL TO authenticated
  USING (public.has_permission('stock.manage'))
  WITH CHECK (public.has_permission('stock.manage'));

-- ============ CUSTOMERS (baca: semua login; tulis: customer.manage) ============
CREATE POLICY "customers_select_authenticated"
  ON public.customers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "customers_manage_customer_manager"
  ON public.customers FOR ALL TO authenticated
  USING (public.has_permission('customer.manage'))
  WITH CHECK (public.has_permission('customer.manage'));

-- ============ SHIFTS (insert: shift milik sendiri; kelola: shift.manage) ============
CREATE POLICY "shifts_select_authenticated"
  ON public.shifts FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "shifts_insert_own"
  ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shifts_manage_shift_manager"
  ON public.shifts FOR ALL TO authenticated
  USING (public.has_permission('shift.manage'))
  WITH CHECK (public.has_permission('shift.manage'));

CREATE POLICY "cash_movements_select_authenticated"
  ON public.cash_movements FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "cash_movements_manage_shift_manager"
  ON public.cash_movements FOR ALL TO authenticated
  USING (public.has_permission('shift.manage'))
  WITH CHECK (public.has_permission('shift.manage'));

-- ============ SALES (insert: kasir untuk user_id sendiri; update: sale.void) ============
CREATE POLICY "sales_select_authenticated"
  ON public.sales FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "sales_insert_own"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_permission('sale.create')
  );
CREATE POLICY "sales_update_void_manager"
  ON public.sales FOR UPDATE TO authenticated
  USING (public.has_permission('sale.void'))
  WITH CHECK (public.has_permission('sale.void'));

CREATE POLICY "sale_items_select_authenticated"
  ON public.sale_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "sale_items_insert_sale_creator"
  ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('sale.create'));

CREATE POLICY "sale_payments_select_authenticated"
  ON public.sale_payments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "sale_payments_insert_sale_creator"
  ON public.sale_payments FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('sale.create'));

-- ============ RETURNS (baca: semua login; tulis: sale.return) ============
CREATE POLICY "sale_returns_select_authenticated"
  ON public.sale_returns FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "sale_returns_manage_return_manager"
  ON public.sale_returns FOR ALL TO authenticated
  USING (public.has_permission('sale.return'))
  WITH CHECK (public.has_permission('sale.return'));

CREATE POLICY "sale_return_items_select_authenticated"
  ON public.sale_return_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "sale_return_items_manage_return_manager"
  ON public.sale_return_items FOR ALL TO authenticated
  USING (public.has_permission('sale.return'))
  WITH CHECK (public.has_permission('sale.return'));

-- ============ SETTINGS / PAYMENT / SEQUENCE (baca: semua login; tulis: settings.manage) ============
CREATE POLICY "settings_select_authenticated"
  ON public.settings FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "settings_manage_settings_manager"
  ON public.settings FOR ALL TO authenticated
  USING (public.has_permission('settings.manage'))
  WITH CHECK (public.has_permission('settings.manage'));

CREATE POLICY "payment_methods_select_authenticated"
  ON public.payment_methods FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "payment_methods_manage_settings_manager"
  ON public.payment_methods FOR ALL TO authenticated
  USING (public.has_permission('settings.manage'))
  WITH CHECK (public.has_permission('settings.manage'));

CREATE POLICY "number_sequences_select_authenticated"
  ON public.number_sequences FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "number_sequences_manage_settings_manager"
  ON public.number_sequences FOR ALL TO authenticated
  USING (public.has_permission('settings.manage'))
  WITH CHECK (public.has_permission('settings.manage'));

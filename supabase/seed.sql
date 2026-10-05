-- Sub-PRD 0.3: seed data untuk development (PRD 0.3 bagian 8).
-- Dijalankan otomatis oleh `supabase db reset` (config: [db.seed] enabled).

BEGIN;

-- ============ ROLES ============
INSERT INTO public.roles (id, name, is_system) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Owner', TRUE),
  ('10000000-0000-4000-8000-000000000002', 'Admin', TRUE),
  ('10000000-0000-4000-8000-000000000003', 'Manajer', TRUE),
  ('10000000-0000-4000-8000-000000000004', 'Kasir', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============ PERMISSIONS ============
INSERT INTO public.permissions (code, description) VALUES
  ('user.manage', 'Kelola user (buat, edit, nonaktifkan)'),
  ('role.manage', 'Kelola role dan permission'),
  ('product.manage', 'Kelola produk, kategori, brand, satuan'),
  ('stock.manage', 'Kelola stok (adjust, opname)'),
  ('opname.approve', 'Approve stock opname'),
  ('sale.create', 'Buat transaksi penjualan'),
  ('sale.void', 'Void transaksi penjualan'),
  ('sale.return', 'Retur dan refund penjualan'),
  ('sale.discount', 'Beri diskon'),
  ('shift.manage', 'Kelola shift dan kas (buka/tutup, kas in/out)'),
  ('customer.manage', 'Kelola data pelanggan'),
  ('report.view', 'Lihat laporan operasional'),
  ('report.profit.view', 'Lihat laporan laba'),
  ('settings.manage', 'Kelola pengaturan toko dan metode bayar'),
  ('purchasing.manage', 'Kelola supplier, PO, dan penerimaan barang'),
  ('promo.manage', 'Kelola promo dan voucher'),
  ('finance.manage', 'Kelola keuangan dan pengeluaran'),
  ('audit.view', 'Lihat audit log')
ON CONFLICT (code) DO NOTHING;

-- ============ ROLE_PERMISSIONS ============
-- Owner: semua permission
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-4000-8000-000000000001', p.id FROM public.permissions p
ON CONFLICT DO NOTHING;

-- Admin: semua kecuali role.manage
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-4000-8000-000000000002', p.id FROM public.permissions p
WHERE p.code <> 'role.manage'
ON CONFLICT DO NOTHING;

-- Manajer: operasional toko
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-4000-8000-000000000003', p.id FROM public.permissions p
WHERE p.code IN (
  'sale.create', 'sale.void', 'sale.return', 'sale.discount',
  'stock.manage', 'opname.approve', 'shift.manage',
  'customer.manage', 'report.view', 'audit.view'
)
ON CONFLICT DO NOTHING;

-- Kasir: transaksi harian
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-4000-8000-000000000004', p.id FROM public.permissions p
WHERE p.code IN ('sale.create', 'sale.discount')
ON CONFLICT DO NOTHING;

-- ============ PAYMENT_METHODS ============
INSERT INTO public.payment_methods (id, name, type, is_active) VALUES
  ('30000000-0000-4000-8000-000000000001', 'Tunai', 'cash', TRUE),
  ('30000000-0000-4000-8000-000000000002', 'QRIS', 'qris', TRUE),
  ('30000000-0000-4000-8000-000000000003', 'Transfer Bank', 'transfer', TRUE),
  ('30000000-0000-4000-8000-000000000004', 'EDC / Kartu', 'card', TRUE),
  ('30000000-0000-4000-8000-000000000005', 'E-Wallet', 'ewallet', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============ NUMBER_SEQUENCES ============
INSERT INTO public.number_sequences (name, prefix, last_value) VALUES
  ('invoice', 'INV', 0),
  ('po', 'PO', 0),
  ('gr', 'GR', 0),
  ('return', 'RTN', 0),
  ('opname', 'OPN', 0)
ON CONFLICT (name) DO NOTHING;

-- ============ SETTINGS ============
INSERT INTO public.settings (key, value) VALUES
  ('store.name', '"Toko DNAE"'),
  ('store.address', '"Jl. Contoh No. 1, Jakarta"'),
  ('store.phone', '"0812-0000-0000"'),
  ('store.logo_url', '""'),
  ('receipt.footer', '"Terima kasih telah berbelanja."'),
  ('tax.rate', '0'),
  ('tax.mode', '"exclusive"'),
  ('service_fee.rate', '0'),
  ('stock.allow_negative', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============ CATEGORIES ============
INSERT INTO public.categories (id, parent_id, name) VALUES
  ('c0000000-0000-4000-8000-000000000001', NULL, 'Sembako'),
  ('c0000000-0000-4000-8000-000000000002', NULL, 'Minuman'),
  ('c0000000-0000-4000-8000-000000000003', NULL, 'Snack'),
  ('c0000000-0000-4000-8000-000000000004', NULL, 'Kebersihan'),
  ('c0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'Bumbu Dapur')
ON CONFLICT (id) DO NOTHING;

-- ============ BRANDS ============
INSERT INTO public.brands (id, name) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Umum'),
  ('b0000000-0000-4000-8000-000000000002', 'ABC'),
  ('b0000000-0000-4000-8000-000000000003', 'Indofood'),
  ('b0000000-0000-4000-8000-000000000004', 'Wings')
ON CONFLICT (id) DO NOTHING;

-- ============ UNITS ============
INSERT INTO public.units (id, name, short_name) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Pcs', 'pcs'),
  ('a0000000-0000-4000-8000-000000000002', 'Pack', 'pack'),
  ('a0000000-0000-4000-8000-000000000003', 'Dus', 'dus'),
  ('a0000000-0000-4000-8000-000000000004', 'Kilogram', 'kg'),
  ('a0000000-0000-4000-8000-000000000005', 'Liter', 'L')
ON CONFLICT (id) DO NOTHING;

-- ============ PRODUCTS (8 produk contoh) ============
INSERT INTO public.products (id, category_id, brand_id, unit_id, name, description) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'Beras Premium 5kg', 'Beras pulen kualitas premium'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'Minyak Goreng', 'Minyak goreng kelapa sawit'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'Gula Pasir 1kg', 'Gula pasir kristal putih'),
  ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Mie Instan', 'Mie instan favorit keluarga'),
  ('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Kopi Sachet', 'Kopi instan sachet'),
  ('d0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Teh Manis Botol', 'Teh manis dalam kemasan botol'),
  ('d0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Sabun Mandi Batang', 'Sabun mandi batang wangi segar'),
  ('d0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Air Mineral 600ml', 'Air mineral kemasan 600ml')
ON CONFLICT (id) DO NOTHING;

-- ============ PRODUCT_VARIANTS (10 varian) ============
INSERT INTO public.product_variants
  (id, product_id, sku, barcode, variant_name, cost_price, sell_price, min_stock, track_stock)
VALUES
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'BRS-5KG', '8990000000011', 'Karung 5kg', 62000, 68500, 10, TRUE),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'MG-2L', '8990000000028', 'Botol 2L', 41000, 45500, 12, TRUE),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002', 'MG-1L', '8990000000035', 'Botol 1L', 21000, 23500, 12, TRUE),
  ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000003', 'GULA-1KG', '8990000000042', 'Kemasan 1kg', 16500, 18500, 20, TRUE),
  ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004', 'MIE-GRG', '8990000000059', 'Goreng', 2900, 3500, 48, TRUE),
  ('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000004', 'MIE-KUH', '8990000000066', 'Kuah', 2900, 3500, 48, TRUE),
  ('e0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000005', 'KOPI-CLS', '8990000000073', 'Classic', 1500, 2000, 60, TRUE),
  ('e0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000006', 'TEH-BTL', '8990000000080', 'Botol', 3800, 5000, 24, TRUE),
  ('e0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000007', 'SABUN-BTG', '8990000000097', 'Batang', 4700, 6000, 24, TRUE),
  ('e0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000008', 'AM-600', '8990000000103', '600ml', 2500, 3500, 48, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============ STOCKS + STOCK_MOVEMENTS (saldo awal konsisten) ============
INSERT INTO public.stocks (variant_id, qty) VALUES
  ('e0000000-0000-4000-8000-000000000001', 50),
  ('e0000000-0000-4000-8000-000000000002', 40),
  ('e0000000-0000-4000-8000-000000000003', 60),
  ('e0000000-0000-4000-8000-000000000004', 80),
  ('e0000000-0000-4000-8000-000000000005', 200),
  ('e0000000-0000-4000-8000-000000000006', 200),
  ('e0000000-0000-4000-8000-000000000007', 300),
  ('e0000000-0000-4000-8000-000000000008', 120),
  ('e0000000-0000-4000-8000-000000000009', 90),
  ('e0000000-0000-4000-8000-000000000010', 150)
ON CONFLICT (variant_id) DO NOTHING;

INSERT INTO public.stock_movements
  (variant_id, type, qty_change, balance_after, ref_type, note)
SELECT v.variant_id, 'purchase', v.qty, v.qty, 'seed', 'Stok awal seed'
FROM (VALUES
  ('e0000000-0000-4000-8000-000000000001'::uuid, 50::numeric),
  ('e0000000-0000-4000-8000-000000000002', 40),
  ('e0000000-0000-4000-8000-000000000003', 60),
  ('e0000000-0000-4000-8000-000000000004', 80),
  ('e0000000-0000-4000-8000-000000000005', 200),
  ('e0000000-0000-4000-8000-000000000006', 200),
  ('e0000000-0000-4000-8000-000000000007', 300),
  ('e0000000-0000-4000-8000-000000000008', 120),
  ('e0000000-0000-4000-8000-000000000009', 90),
  ('e0000000-0000-4000-8000-000000000010', 150)
) AS v (variant_id, qty)
WHERE NOT EXISTS (
  SELECT 1 FROM public.stock_movements sm
  WHERE sm.variant_id = v.variant_id AND sm.ref_type = 'seed'
);

COMMIT;

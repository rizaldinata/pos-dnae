-- Sub-PRD 0.3: index penting (PRD 6.6).
-- Index FK/umum sudah dibuat di migrasi tabel; di sini khusus
-- pencarian (trigram) dan kolom yang sering difilter/diurut.

-- Pencarian fuzzy nama produk untuk kasir (< 300ms).
CREATE INDEX idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);

-- Pencarian kategori.
CREATE INDEX idx_categories_name_trgm
  ON public.categories USING gin (name gin_trgm_ops);

-- Pencarian pelanggan (nama / telepon).
CREATE INDEX idx_customers_name_trgm
  ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX idx_customers_phone ON public.customers (phone);

-- Lookup invoice & idempotency (UNIQUE sudah memberi index,
-- dibuat eksplisit agar jelas di EXPLAIN).
CREATE UNIQUE INDEX idx_sales_invoice_no ON public.sales (invoice_no);
CREATE UNIQUE INDEX idx_sales_idempotency_key ON public.sales (idempotency_key);

-- SKU / barcode (UNIQUE constraint sudah memberi index).
CREATE UNIQUE INDEX idx_product_variants_sku ON public.product_variants (sku);
CREATE UNIQUE INDEX idx_product_variants_barcode ON public.product_variants (barcode);

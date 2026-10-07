-- Sub-PRD PRD-03: foto per varian.
-- Produk multi-rasa (mis. "scream" dengan5 varian rasa) butuh gambar berbeda
-- per varian sementara products.image_url hanya1. Nullable: varian lama tanpa
-- foto bernilai NULL dan tampilan jatuh (fallback) ke gambar produk.
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS image_url text;

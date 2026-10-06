-- Sub-PRD 2.7: PIN kasir (AUTH-02) + foto produk (PRD-03).
-- profiles: pin_hash + throttle PIN (3x salah -> kunci 15 menit).
-- bucket product-images: baca publik, tulis product.manage.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_attempts integer NOT NULL DEFAULT 0 CHECK (pin_attempts >= 0),
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_manage_product_manager"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND public.has_permission('product.manage'))
  WITH CHECK (bucket_id = 'product-images' AND public.has_permission('product.manage'));

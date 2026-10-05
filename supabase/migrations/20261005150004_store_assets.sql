-- Sub-PRD 1.5: bucket logo toko (baca publik, tulis khusus settings.manage).

INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "store_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets');

CREATE POLICY "store_assets_manage_settings_manager"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'store-assets' AND public.has_permission('settings.manage'))
  WITH CHECK (bucket_id = 'store-assets' AND public.has_permission('settings.manage'));

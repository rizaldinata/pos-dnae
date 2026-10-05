-- Sub-PRD 1.1: izinkan inisialisasi baris stok (qty 0) saat varian dibuat.
-- Perubahan stok selanjutnya tetap hanya lewat function RPC SECURITY DEFINER
-- (create_sale, receive_goods, ...) — tidak ada policy UPDATE/DELETE di sini.

CREATE POLICY "stocks_insert_product_manager"
  ON public.stocks FOR INSERT TO authenticated
  WITH CHECK (
    qty = 0
    AND public.has_permission('product.manage')
  );

import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { StorefrontProduct, StorefrontSettings } from "../entities/order";

/**
 * Port katalog untuk halaman publik (landing page toko).
 * Diimplementasikan dengan service-role client karena RLS melarang anon.
 */
export interface IStorefrontCatalogPort {
  /** Produk aktif + varian + ketersediaan stok untuk ditampilkan publik. */
  listProducts(): Promise<Result<StorefrontProduct[], DomainError>>;

  /** Pengaturan toko untuk header/halaman publik. */
  getSettings(): Promise<Result<StorefrontSettings, DomainError>>;
}

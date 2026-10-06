import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export interface BundleItemInput {
  componentVariantId: string;
  qty: number;
}

export interface BundleComponent {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  qty: number;
  stockQty: number;
}

export interface ComponentInfo {
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  isBundle: boolean;
}

/**
 * Komponen bundle dikonfigurasi per produk (Sub-PRD 4.1): daftar yang sama
 * disimpan untuk semua varian produk agar varian mana pun yang dijual tidak
 * pernah gagal dengan BUNDLE_EMPTY.
 */
export interface IBundleRepository {
  listByProduct(
    productId: string
  ): Promise<Result<BundleComponent[], DomainError>>;
  describeComponents(
    variantIds: string[]
  ): Promise<Result<Record<string, ComponentInfo>, DomainError>>;
  replaceForProduct(
    productId: string,
    items: BundleItemInput[]
  ): Promise<Result<void, DomainError>>;
}

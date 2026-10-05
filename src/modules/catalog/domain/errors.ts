import { DomainError } from "@/shared/kernel/errors";

export class DuplicateSkuError extends DomainError {
  public readonly code = "DUPLICATE_SKU";

  constructor(sku: string) {
    super(`SKU "${sku}" sudah dipakai produk lain`);
  }
}

export class DuplicateBarcodeError extends DomainError {
  public readonly code = "DUPLICATE_BARCODE";

  constructor(barcode: string) {
    super(`Barcode "${barcode}" sudah dipakai produk lain`);
  }
}

export class ProductHasNoVariantError extends DomainError {
  public readonly code = "PRODUCT_HAS_NO_VARIANT";

  constructor() {
    super("Produk harus memiliki minimal 1 varian");
  }
}

export class VariantInUseError extends DomainError {
  public readonly code = "VARIANT_IN_USE";

  constructor(sku: string) {
    super(
      `Varian "${sku}" tidak dapat dihapus karena sudah memiliki riwayat transaksi/stok`
    );
  }
}

export class MasterDataInUseError extends DomainError {
  public readonly code = "MASTER_DATA_IN_USE";

  constructor(name: string) {
    super(`"${name}" tidak dapat dihapus karena masih dipakai produk`);
  }
}

export class CategoryHasChildrenError extends DomainError {
  public readonly code = "CATEGORY_HAS_CHILDREN";

  constructor(name: string) {
    super(`Kategori "${name}" masih memiliki sub-kategori`);
  }
}

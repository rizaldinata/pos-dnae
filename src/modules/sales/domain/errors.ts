import { DomainError } from "@/shared/kernel/errors";

export class InsufficientStockError extends DomainError {
  public readonly code = "INSUFFICIENT_STOCK";

  constructor(sku: string) {
    super(`Stok tidak cukup untuk SKU "${sku || "?"}"`);
  }
}

export class UnderpaidError extends DomainError {
  public readonly code = "UNDERPAID";

  constructor() {
    super("Total pembayaran kurang dari total tagihan");
  }
}

export class InvalidPaymentMethodError extends DomainError {
  public readonly code = "INVALID_PAYMENT_METHOD";

  constructor() {
    super("Metode pembayaran tidak valid atau tidak aktif");
  }
}

export class SaleNotFoundError extends DomainError {
  public readonly code = "SALE_NOT_FOUND";

  constructor(ref?: string) {
    super(
      ref ? `Transaksi "${ref}" tidak ditemukan` : "Transaksi tidak ditemukan"
    );
  }
}

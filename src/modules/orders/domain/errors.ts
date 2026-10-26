import { DomainError } from "@/shared/kernel/errors";

export class PlaceOrderError extends DomainError {
  public readonly code = "PLACE_ORDER_FAILED";

  constructor(message = "Gagal membuat pesanan") {
    super(message);
  }
}

export class OrderNotFoundError extends DomainError {
  public readonly code = "ORDER_NOT_FOUND";

  constructor(orderNo?: string) {
    super(
      orderNo ? `Pesanan ${orderNo} tidak ditemukan` : "Pesanan tidak ditemukan"
    );
  }
}

export class OutOfStockError extends DomainError {
  public readonly code = "OUT_OF_STOCK";

  constructor() {
    super("Stok salah satu produk tidak mencukupi");
  }
}

export class ProductUnavailableError extends DomainError {
  public readonly code = "PRODUCT_UNAVAILABLE";

  constructor() {
    super("Salah satu produk dalam pesanan sudah tidak tersedia");
  }
}

export class InvalidOrderTransitionError extends DomainError {
  public readonly code = "INVALID_ORDER_TRANSITION";

  constructor(from: string, to: string) {
    super(`Status pesanan tidak dapat diubah dari "${from}" ke "${to}"`);
  }
}

export class OrderNotCancellableError extends DomainError {
  public readonly code = "ORDER_NOT_CANCELLABLE";

  constructor() {
    super("Pesanan ini sudah tidak dapat dibatalkan");
  }
}

export class OrderStatusConflictError extends DomainError {
  public readonly code = "ORDER_STATUS_CONFLICT";

  constructor() {
    super(
      "Status pesanan baru saja berubah oleh staf lain. Muat ulang halaman."
    );
  }
}

export class PaymentProofError extends DomainError {
  public readonly code = "PAYMENT_PROOF_ERROR";

  constructor(message = "Gagal mengunggah bukti pembayaran") {
    super(message);
  }
}

/**
 * Memetakan kode error mentah dari RPC `place_online_order`
 * ke pesan yang aman ditampilkan ke pelanggan.
 */
export function mapPlaceOrderFailure(code: string): DomainError {
  switch (code) {
    case "OUT_OF_STOCK":
      return new OutOfStockError();
    case "VARIANT_INACTIVE":
      return new ProductUnavailableError();
    case "INVALID_NAME":
      return new PlaceOrderError("Nama pelanggan tidak valid");
    case "INVALID_PHONE":
      return new PlaceOrderError("Nomor HP tidak valid");
    case "INVALID_FULFILLMENT":
      return new PlaceOrderError("Cara penerimaan pesanan tidak valid");
    case "INVALID_ADDRESS":
      return new PlaceOrderError(
        "Alamat pengiriman wajib diisi (maksimal 300 karakter)"
      );
    case "INVALID_PAYMENT":
      return new PlaceOrderError("Metode pembayaran tidak valid");
    case "INVALID_ITEMS":
    case "INVALID_QTY":
    case "DUPLICATE_ITEM":
      return new PlaceOrderError("Item pesanan tidak valid");
    default:
      return new PlaceOrderError();
  }
}

/** Status pesanan online dari landing page publik. */
export type OrderStatus =
  "pending" | "confirmed" | "ready" | "completed" | "cancelled";

/** Cara pelanggan menerima pesanan. */
export type OrderFulfillment = "pickup" | "delivery";

/**
 * Metode pembayaran pesanan online:
 * - cod: bayar tunai saat serah terima.
 * - qris: transfer via QRIS; pelanggan upload bukti, staf verifikasi.
 */
export type OrderPaymentType = "cod" | "qris";

export interface OrderItem {
  variantId: string;
  productName: string;
  variantName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OnlineOrder {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  fulfillment: OrderFulfillment;
  address: string;
  note: string;
  paymentType: OrderPaymentType;
  /** Path objek di bucket payment-proofs; kosong bila belum ada bukti. */
  paymentProofPath: string;
  status: OrderStatus;
  subtotal: number;
  total: number;
  cancelReason: string;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

/** Ringkasan untuk daftar staf (tanpa item). */
export type OnlineOrderSummary = Omit<OnlineOrder, "items"> & {
  itemCount: number;
  totalQty: number;
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Menunggu verifikasi",
  confirmed: "Diterima",
  ready: "Siap",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

/**
 * Transisi status yang sah. Batal boleh dari pending/confirmed/ready
 * (stok dikembalikan oleh fungsi DB); completed adalah status akhir.
 */
const STATUS_FLOW: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return STATUS_FLOW[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_FLOW[from].includes(to);
}

/** Varian yang ditampilkan di katalog publik. */
export interface StorefrontVariant {
  id: string;
  name: string;
  sellPrice: number;
  /** true bila stok mencukupi untuk dibeli (track_stock=false selalu tersedia). */
  isAvailable: boolean;
}

/** Produk aktif yang ditampilkan di landing page. */
export interface StorefrontProduct {
  productId: string;
  name: string;
  description: string;
  imageUrl: string;
  categoryName: string;
  variants: StorefrontVariant[];
}

/** Pengaturan toko yang tampil di halaman publik. */
export interface StorefrontSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeLogoUrl: string;
  /** Path gambar QRIS (bucket store-assets, public read). */
  qrisImagePath: string;
}

/** Hasil pembuatan pesanan oleh pelanggan. */
export interface PlacedOrder {
  id: string;
  orderNo: string;
  subtotal: number;
  total: number;
  createdAt: string;
}

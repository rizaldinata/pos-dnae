import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  OnlineOrder,
  OnlineOrderSummary,
  OrderStatus,
  PlacedOrder,
} from "../entities/order";

export interface PlaceOrderRecord {
  customerName: string;
  customerPhone: string;
  fulfillment: "pickup" | "delivery";
  address: string;
  note: string;
  paymentType: "cod" | "qris";
  items: { variantId: string; qty: number }[];
}

export interface ListOrdersFilter {
  status?: OrderStatus | null;
  search?: string | null;
  page: number;
  pageSize: number;
}

export interface ListOrdersResult {
  items: OnlineOrderSummary[];
  total: number;
}

/**
 * Port penyimpanan pesanan online. Semua operasi dijalankan server-side
 * via service-role client (tabel tidak dapat diakses anon langsung).
 */
export interface IOrderRepository {
  /** Membuat pesanan + mengurangi stok secara atomik (RPC place_online_order). */
  placeOrder(
    record: PlaceOrderRecord
  ): Promise<Result<PlacedOrder, DomainError>>;

  /** Pesanan lengkap (dengan items) berdasarkan nomor. */
  findByOrderNo(
    orderNo: string
  ): Promise<Result<OnlineOrder | null, DomainError>>;

  /** Pesanan lengkap (dengan items) berdasarkan id. */
  findById(id: string): Promise<Result<OnlineOrder | null, DomainError>>;

  /** Daftar pesanan untuk halaman staf (tanpa items). */
  listOrders(
    filter: ListOrdersFilter
  ): Promise<Result<ListOrdersResult, DomainError>>;

  /**
   * Mengubah status dengan guard optimistic (`expected`): gagal bila status
   * di DB sudah berbeda (ditangani staf lain).
   */
  updateStatus(
    id: string,
    expected: OrderStatus,
    next: OrderStatus,
    actorId: string
  ): Promise<Result<OnlineOrder, DomainError>>;

  /** Membatalkan pesanan + mengembalikan stok (RPC cancel_online_order). */
  cancelOrder(
    id: string,
    reason: string,
    actorId: string
  ): Promise<Result<OnlineOrder, DomainError>>;

  /** Menyimpan path bukti bayar QRIS pada pesanan. */
  attachPaymentProof(
    id: string,
    proofPath: string
  ): Promise<Result<void, DomainError>>;

  /** Mengunggah berkas bukti bayar ke bucket payment-proofs; mengembalikan path. */
  uploadPaymentProof(
    orderNo: string,
    file: { bytes: Uint8Array; contentType: string }
  ): Promise<Result<string, DomainError>>;

  /** Signed URL (1 jam) bukti bayar untuk ditampilkan staf. */
  createProofSignedUrl(
    path: string
  ): Promise<Result<string | null, DomainError>>;
}

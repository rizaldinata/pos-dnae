import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";
import {
  OrderNotCancellableError,
  OrderNotFoundError,
  OrderStatusConflictError,
  PaymentProofError,
  PlaceOrderError,
} from "../domain/errors";
import type {
  OnlineOrder,
  OnlineOrderSummary,
  OrderFulfillment,
  OrderItem,
  OrderPaymentType,
  OrderStatus,
} from "../domain/entities/order";
import type {
  IOrderRepository,
  ListOrdersFilter,
  ListOrdersResult,
  PlaceOrderRecord,
} from "../domain/repositories/order.repository";

interface OrderItemRow {
  id: string;
  order_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

interface OrderRow {
  id: string;
  order_no: string;
  customer_name: string;
  customer_phone: string;
  fulfillment: string;
  address: string;
  note: string;
  payment_type: string;
  payment_proof_path: string;
  status: string;
  subtotal: number;
  total: number;
  cancel_reason: string;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

type OrderWithItemsRow = OrderRow & { order_items: OrderItemRow[] };

const ORDER_WITH_ITEMS_SELECT = "*, order_items(*)";

function mapItem(row: OrderItemRow): OrderItem {
  return {
    variantId: row.variant_id,
    productName: row.product_name,
    variantName: row.variant_name,
    qty: Number(row.qty),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
  };
}

function mapOrder(row: OrderWithItemsRow): OnlineOrder {
  return {
    id: row.id,
    orderNo: row.order_no,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    fulfillment: row.fulfillment as OrderFulfillment,
    address: row.address,
    note: row.note,
    paymentType: row.payment_type as OrderPaymentType,
    paymentProofPath: row.payment_proof_path,
    status: row.status as OrderStatus,
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    cancelReason: row.cancel_reason,
    processedBy: row.processed_by,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.order_items ?? []).map(mapItem),
  };
}

function mapSummary(row: OrderWithItemsRow): OnlineOrderSummary {
  const order = mapOrder(row);
  const { items, ...rest } = order;
  return {
    ...rest,
    itemCount: items.length,
    totalQty: items.reduce((sum, item) => sum + item.qty, 0),
  };
}

/** Hilangkan karakter yang dapat mengganggu sintaks filter ilike/or(). */
function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[%_,()]/g, "")
    .trim()
    .slice(0, 50);
}

/**
 * Repository pesanan online. Memakai service-role client: tabel orders
 * tidak dapat ditulis langsung oleh anon maupun sesi karyawan (RLS),
 * semua tulis melewati fungsi RPC/transaksi server.
 */
export class SupabaseOrderRepository implements IOrderRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async placeOrder(record: PlaceOrderRecord): Promise<
    Result<
      {
        id: string;
        orderNo: string;
        subtotal: number;
        total: number;
        createdAt: string;
      },
      DomainError
    >
  > {
    const { data, error } = await this.client.rpc("place_online_order", {
      p_payload: {
        customer_name: record.customerName,
        customer_phone: record.customerPhone,
        fulfillment: record.fulfillment,
        address: record.address,
        note: record.note,
        payment_type: record.paymentType,
        items: record.items.map((item) => ({
          variant_id: item.variantId,
          qty: item.qty,
        })),
      },
    });
    if (error || !data) {
      // Pesan error RPC adalah kode mentah (mis. OUT_OF_STOCK) yang
      // diterjemahkan use case ke bahasa pelanggan.
      return err(new PlaceOrderError(error?.message ?? "PLACE_ORDER_FAILED"));
    }
    const placed = data as {
      id: string;
      order_no: string;
      subtotal: number;
      total: number;
      created_at: string;
    };
    return ok({
      id: placed.id,
      orderNo: placed.order_no,
      subtotal: Number(placed.subtotal),
      total: Number(placed.total),
      createdAt: String(placed.created_at),
    });
  }

  public async findByOrderNo(
    orderNo: string
  ): Promise<Result<OnlineOrder | null, DomainError>> {
    const { data, error } = await this.client
      .from("orders")
      .select(ORDER_WITH_ITEMS_SELECT)
      .eq("order_no", orderNo)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const row = data as unknown as OrderWithItemsRow | null;
    return ok(row ? mapOrder(row) : null);
  }

  public async listOrders(
    filter: ListOrdersFilter
  ): Promise<Result<ListOrdersResult, DomainError>> {
    let query = this.client
      .from("orders")
      .select(ORDER_WITH_ITEMS_SELECT, { count: "exact" });
    if (filter.status) {
      query = query.eq("status", filter.status);
    }
    const search = filter.search ? sanitizeSearch(filter.search) : "";
    if (search) {
      query = query.or(
        `order_no.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_name.ilike.%${search}%`
      );
    }
    const from = (filter.page - 1) * filter.pageSize;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + filter.pageSize - 1);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const rows = (data ?? []) as unknown as OrderWithItemsRow[];
    return ok({
      items: rows.map(mapSummary),
      total: count ?? 0,
    });
  }

  public async updateStatus(
    id: string,
    expected: OrderStatus,
    next: OrderStatus,
    actorId: string
  ): Promise<Result<OnlineOrder, DomainError>> {
    const { data, error } = await this.client
      .from("orders")
      .update({
        status: next,
        processed_by: actorId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id)
      // Guard optimistic: hanya bila status di DB masih sesuai harapan.
      .eq("status", expected)
      .select(ORDER_WITH_ITEMS_SELECT)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (!data) {
      const exists = await this.findById(id);
      if (!exists.success) {
        return err(exists.error);
      }
      return exists.data
        ? err(new OrderStatusConflictError())
        : err(new OrderNotFoundError());
    }
    return ok(mapOrder(data as unknown as OrderWithItemsRow));
  }

  public async cancelOrder(
    id: string,
    reason: string,
    actorId: string
  ): Promise<Result<OnlineOrder, DomainError>> {
    const { data, error } = await this.client.rpc("cancel_online_order", {
      p_order_id: id,
      p_reason: reason,
      p_actor: actorId,
    });
    if (error || !data) {
      const message = error?.message ?? "";
      if (message.includes("ORDER_NOT_CANCELLABLE")) {
        return err(new OrderNotCancellableError());
      }
      if (message.includes("ORDER_NOT_FOUND")) {
        return err(new OrderNotFoundError());
      }
      return err(
        new InvariantViolationError(
          `Database error: ${message || "cancel failed"}`
        )
      );
    }
    const cancelled = data as unknown as OrderRow;
    const withItems = await this.findByOrderNo(cancelled.order_no);
    if (!withItems.success || !withItems.data) {
      return ok({ ...mapOrder({ ...cancelled, order_items: [] }) });
    }
    return ok(withItems.data);
  }

  public async attachPaymentProof(
    id: string,
    proofPath: string
  ): Promise<Result<void, DomainError>> {
    const { error } = await this.client
      .from("orders")
      .update({ payment_proof_path: proofPath })
      .eq("id", id);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(undefined);
  }

  public async uploadPaymentProof(
    orderNo: string,
    file: { bytes: Uint8Array; contentType: string }
  ): Promise<Result<string, DomainError>> {
    const ext =
      file.contentType === "image/jpeg"
        ? "jpg"
        : file.contentType === "image/png"
          ? "png"
          : "webp";
    const path = `${orderNo}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.client.storage
      .from("payment-proofs")
      .upload(path, file.bytes, {
        contentType: file.contentType,
        upsert: false,
      });
    if (error) {
      return err(
        new PaymentProofError(`Gagal menyimpan berkas: ${error.message}`)
      );
    }
    return ok(path);
  }

  public async createProofSignedUrl(
    path: string
  ): Promise<Result<string | null, DomainError>> {
    const { data, error } = await this.client.storage
      .from("payment-proofs")
      .createSignedUrl(path, 3600);
    if (error || !data) {
      // Bukti gagal dimuat tidak boleh meruntuhkan halaman detail.
      return ok(null);
    }
    return ok(data.signedUrl);
  }

  public async findById(
    id: string
  ): Promise<Result<OnlineOrder | null, DomainError>> {
    const { data, error } = await this.client
      .from("orders")
      .select(ORDER_WITH_ITEMS_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const row = data as unknown as OrderWithItemsRow | null;
    return ok(row ? mapOrder(row) : null);
  }
}

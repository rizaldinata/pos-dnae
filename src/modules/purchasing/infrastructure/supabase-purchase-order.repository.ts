import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  CreatePOInput,
  IPurchaseOrderRepository,
  POItemInput,
  POListFilter,
  POListResult,
  PurchaseReturnItemInput,
  ReceiveItemInput,
} from "@/modules/purchasing/domain/repositories/purchase-order.repository";
import {
  PurchaseOrder,
  PurchaseOrderItem,
  type GoodsReceiptInfo,
  type PurchaseOrderStatus,
  type PurchaseReturnInfo,
} from "@/modules/purchasing/domain/entities/purchasing";
import { Money } from "@/shared/lib/money";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";

const PO_STATUSES: PurchaseOrderStatus[] = [
  "draft",
  "sent",
  "partial",
  "completed",
  "cancelled",
];

interface POItemRow {
  id: string;
  po_id: string;
  variant_id: string;
  qty: number | string;
  cost_price: number | string;
  received_qty: number | string;
  product_variants: {
    sku: string;
    variant_name: string;
    products: { name: string } | null;
  } | null;
}

interface PORow {
  id: string;
  po_no: string;
  supplier_id: string;
  status: string;
  order_date: string;
  notes: string;
  total: number | string;
  created_at: string;
  updated_at: string;
  suppliers: { name: string } | null;
  purchase_order_items: POItemRow[];
}

const PO_SELECT = `
  id,
  po_no,
  supplier_id,
  status,
  order_date,
  notes,
  total,
  created_at,
  updated_at,
  suppliers ( name ),
  purchase_order_items (
    id,
    po_id,
    variant_id,
    qty,
    cost_price,
    received_qty,
    product_variants (
      sku,
      variant_name,
      products ( name )
    )
  )
`;

function mapItemRow(row: POItemRow, poId: string): PurchaseOrderItem {
  return PurchaseOrderItem.create(
    {
      poId,
      variantId: row.variant_id,
      productName: row.product_variants?.products?.name ?? "-",
      variantName: row.product_variants?.variant_name ?? "",
      sku: row.product_variants?.sku ?? "",
      qty: Number(row.qty),
      costPrice: Money.create(Math.round(Number(row.cost_price))),
      receivedQty: Number(row.received_qty),
    },
    row.id
  );
}

function mapPORow(row: PORow): PurchaseOrder {
  return PurchaseOrder.create(
    {
      poNo: row.po_no,
      supplierId: row.supplier_id,
      supplierName: row.suppliers?.name,
      status: (PO_STATUSES as string[]).includes(row.status)
        ? (row.status as PurchaseOrderStatus)
        : "draft",
      orderDate: row.order_date,
      notes: row.notes,
      total: Money.create(Math.round(Number(row.total))),
      items: (row.purchase_order_items ?? []).map((item) =>
        mapItemRow(item, row.id)
      ),
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }
  );
}

function mapRpcError(message: string): DomainError {
  if (message.includes("FORBIDDEN")) {
    return new ValidationError("Anda tidak memiliki hak pembelian");
  }
  return new InvariantViolationError(`Pembelian gagal: ${message}`);
}

export class SupabasePurchaseOrderRepository implements IPurchaseOrderRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async create(
    input: CreatePOInput
  ): Promise<Result<{ poId: string; poNo: string }, DomainError>> {
    const { data, error } = await this.client.rpc("create_purchase_order", {
      p_payload: {
        supplier_id: input.supplierId,
        order_date: input.orderDate ?? null,
        notes: input.notes ?? "",
        items: input.items.map((item: POItemInput) => ({
          variant_id: item.variantId,
          qty: item.qty,
          cost_price: item.costPrice,
        })),
      },
    });
    if (error) {
      return err(mapRpcError(error.message));
    }
    const json = data as unknown as { po_id: string; po_no: string };
    return ok({ poId: json.po_id, poNo: json.po_no });
  }

  public async findById(
    id: string
  ): Promise<Result<PurchaseOrder | null, DomainError>> {
    const { data, error } = await this.client
      .from("purchase_orders")
      .select(PO_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapPORow(data as unknown as PORow));
  }

  public async list(
    filter: POListFilter
  ): Promise<Result<POListResult, DomainError>> {
    const page = filter.page ?? 1;
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client
      .from("purchase_orders")
      .select(PO_SELECT, { count: "exact" });
    if (filter.supplierId) {
      query = query.eq("supplier_id", filter.supplierId);
    }
    if (filter.status) {
      query = query.eq("status", filter.status);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok({
      items: ((data ?? []) as unknown as PORow[]).map(mapPORow),
      total: count ?? 0,
      page,
      pageSize,
    });
  }

  public async updateDraft(
    id: string,
    input: { notes?: string; items?: POItemInput[] }
  ): Promise<Result<PurchaseOrder, DomainError>> {
    if (input.notes !== undefined) {
      const { error } = await this.client
        .from("purchase_orders")
        .update({ notes: input.notes })
        .eq("id", id);
      if (error) {
        return err(
          new InvariantViolationError(`Database error: ${error.message}`)
        );
      }
    }
    if (input.items !== undefined) {
      const { error: deleteError } = await this.client
        .from("purchase_order_items")
        .delete()
        .eq("po_id", id);
      if (deleteError) {
        return err(
          new InvariantViolationError(`Database error: ${deleteError.message}`)
        );
      }
      const { error: insertError } = await this.client
        .from("purchase_order_items")
        .insert(
          input.items.map((item) => ({
            po_id: id,
            variant_id: item.variantId,
            qty: item.qty,
            cost_price: item.costPrice,
          }))
        );
      if (insertError) {
        return err(
          new InvariantViolationError(`Database error: ${insertError.message}`)
        );
      }
      const total = input.items.reduce(
        (sum, item) => sum + item.qty * item.costPrice,
        0
      );
      const { error: totalError } = await this.client
        .from("purchase_orders")
        .update({ total: Math.round(total) })
        .eq("id", id);
      if (totalError) {
        return err(
          new InvariantViolationError(`Database error: ${totalError.message}`)
        );
      }
    }
    const updated = await this.findById(id);
    if (!updated.success) {
      return err(updated.error);
    }
    if (updated.data === null) {
      return err(new InvariantViolationError("PO gagal dimuat"));
    }
    return ok(updated.data);
  }

  public async setStatus(
    id: string,
    status: "sent" | "cancelled"
  ): Promise<Result<PurchaseOrder, DomainError>> {
    const { error } = await this.client
      .from("purchase_orders")
      .update({ status })
      .eq("id", id);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const updated = await this.findById(id);
    if (!updated.success) {
      return err(updated.error);
    }
    if (updated.data === null) {
      return err(new InvariantViolationError("PO gagal dimuat"));
    }
    return ok(updated.data);
  }

  public async receiveGoods(
    poId: string,
    items: ReceiveItemInput[],
    note?: string
  ): Promise<Result<GoodsReceiptInfo, DomainError>> {
    const { data, error } = await this.client.rpc("receive_goods", {
      p_payload: {
        po_id: poId,
        note: note ?? "",
        items: items.map((item) => ({
          variant_id: item.variantId,
          qty: item.qty,
          cost_price: item.costPrice,
          batch_no: item.batchNo ?? "",
          expiry_date: item.expiryDate ?? null,
        })),
      },
    });
    if (error) {
      return err(mapRpcError(error.message));
    }
    const json = data as unknown as { gr_id: string; gr_no: string };
    return ok({ id: json.gr_id, grNo: json.gr_no, receivedAt: new Date() });
  }

  public async listReceipts(
    poId: string
  ): Promise<Result<GoodsReceiptInfo[], DomainError>> {
    const { data, error } = await this.client
      .from("goods_receipts")
      .select("id,gr_no,received_at")
      .eq("po_id", poId)
      .order("received_at", { ascending: false });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(
      (
        (data ?? []) as { id: string; gr_no: string; received_at: string }[]
      ).map((row) => ({
        id: row.id,
        grNo: row.gr_no,
        receivedAt: new Date(row.received_at),
      }))
    );
  }

  public async createReturn(
    supplierId: string,
    reason: string,
    items: PurchaseReturnItemInput[]
  ): Promise<Result<PurchaseReturnInfo, DomainError>> {
    const { data, error } = await this.client.rpc("create_purchase_return", {
      p_payload: {
        supplier_id: supplierId,
        reason,
        items: items.map((item) => ({
          variant_id: item.variantId,
          qty: item.qty,
          cost_price: item.costPrice,
        })),
      },
    });
    if (error) {
      return err(mapRpcError(error.message));
    }
    const json = data as unknown as {
      return_id: string;
      return_no: string;
      total_refund: number | string;
    };
    return ok({
      id: json.return_id,
      returnNo: json.return_no,
      reason,
      totalRefund: Money.create(Math.round(Number(json.total_refund))),
      createdAt: new Date(),
    });
  }

  public async listReturns(
    supplierId?: string
  ): Promise<Result<PurchaseReturnInfo[], DomainError>> {
    let query = this.client
      .from("purchase_returns")
      .select("id,return_no,reason,total_refund,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (supplierId) {
      query = query.eq("supplier_id", supplierId);
    }
    const { data, error } = await query;
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(
      (
        (data ?? []) as {
          id: string;
          return_no: string;
          reason: string;
          total_refund: number | string;
          created_at: string;
        }[]
      ).map((row) => ({
        id: row.id,
        returnNo: row.return_no,
        reason: row.reason,
        totalRefund: Money.create(Math.round(Number(row.total_refund))),
        createdAt: new Date(row.created_at),
      }))
    );
  }
}

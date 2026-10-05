import {
  Sale,
  SaleItem,
  SalePayment,
  type SaleReceipt,
  type SaleStatus,
} from "@/modules/sales/domain/entities/sale";
import type {
  CreateSaleRecord,
  CreateReturnRecord,
  CreateReturnResult,
  HeldSaleSummary,
  HoldSaleRecord,
  ISaleRepository,
  ResumeData,
  ReturnListFilter,
  ReturnListResult,
  VoidSaleRecord,
} from "@/modules/sales/domain/repositories/sale.repository";
import {
  InsufficientStockError,
  InvalidPaymentMethodError,
  SaleNotFoundError,
  UnderpaidError,
} from "@/modules/sales/domain/errors";
import { Money } from "@/shared/lib/money";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";

const SALE_STATUSES: SaleStatus[] = [
  "held",
  "completed",
  "void",
  "partial_return",
  "returned",
  "credit",
];

interface ReceiptJson {
  sale: {
    id: string;
    invoice_no: string;
    idempotency_key: string;
    shift_id: string | null;
    user_id: string;
    customer_id: string | null;
    subtotal: number | string;
    discount_total: number | string;
    tax_total: number | string;
    service_fee: number | string;
    rounding: number | string;
    grand_total: number | string;
    paid_total: number | string;
    change_amount: number | string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  items: {
    id: string;
    sale_id: string;
    variant_id: string | null;
    product_name: string;
    sku: string;
    qty: number | string;
    unit_price: number | string;
    cost_price: number | string;
    discount: number | string;
    subtotal: number | string;
    returned_qty?: number | string;
    created_at: string;
  }[];
  payments: {
    id: string;
    payment_method_id: string | null;
    payment_method_name: string | null;
    payment_method_type: string | null;
    amount: number | string;
    reference_no: string | null;
  }[];
}

function toMoney(value: number | string): Money {
  return Money.create(Math.round(Number(value)));
}

export function mapReceiptJson(json: ReceiptJson): SaleReceipt {
  const s = json.sale;
  const sale = Sale.create(
    {
      invoiceNo: s.invoice_no,
      idempotencyKey: s.idempotency_key,
      shiftId: s.shift_id,
      userId: s.user_id,
      customerId: s.customer_id,
      subtotal: toMoney(s.subtotal),
      discountTotal: toMoney(s.discount_total),
      taxTotal: toMoney(s.tax_total),
      serviceFee: toMoney(s.service_fee),
      rounding: toMoney(s.rounding),
      grandTotal: toMoney(s.grand_total),
      paidTotal: toMoney(s.paid_total),
      changeAmount: toMoney(s.change_amount),
      status: (SALE_STATUSES as string[]).includes(s.status)
        ? (s.status as SaleStatus)
        : "completed",
    },
    s.id,
    { createdAt: new Date(s.created_at), updatedAt: new Date(s.updated_at) }
  );

  const items = (json.items ?? []).map((row) =>
    SaleItem.create(
      {
        saleId: row.sale_id,
        variantId: row.variant_id,
        productName: row.product_name,
        sku: row.sku,
        qty: Number(row.qty),
        unitPrice: toMoney(row.unit_price),
        costPrice: toMoney(row.cost_price),
        discount: toMoney(row.discount),
        subtotal: toMoney(row.subtotal),
        returnedQty: Number(row.returned_qty ?? 0),
      },
      row.id,
      {
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.created_at),
      }
    )
  );

  const payments = (json.payments ?? []).map((row, index) =>
    SalePayment.create(
      {
        saleId: s.id,
        paymentMethodId: row.payment_method_id,
        paymentMethodName: row.payment_method_name ?? "-",
        paymentMethodType: row.payment_method_type ?? "-",
        amount: toMoney(row.amount),
        referenceNo: row.reference_no,
      },
      row.id ?? `${s.id}-pay-${index}`,
      { createdAt: new Date(s.created_at), updatedAt: new Date(s.created_at) }
    )
  );

  return { sale, items, payments };
}

function mapRpcError(message: string): DomainError {
  if (message.includes("INSUFFICIENT_STOCK:")) {
    const sku =
      message.split("INSUFFICIENT_STOCK:")[1]?.split(",")[0]?.trim() ?? "";
    return new InsufficientStockError(sku);
  }
  if (message.includes("UNDERPAID")) {
    return new UnderpaidError();
  }
  if (message.includes("INVALID_PAYMENT_METHOD")) {
    return new InvalidPaymentMethodError();
  }
  if (message.includes("SALE_NOT_FOUND")) {
    return new SaleNotFoundError();
  }
  if (
    message.includes("VOID_REASON_REQUIRED") ||
    message.includes("RETURN_REASON_REQUIRED") ||
    message.includes("RETURN_ITEMS_REQUIRED") ||
    message.includes("INVALID_RETURN_QTY") ||
    message.includes("RETURN_QTY_EXCEEDS_SOLD") ||
    message.includes("SALE_ALREADY_VOID") ||
    message.includes("SALE_NOT_VOIDABLE") ||
    message.includes("SALE_NOT_RETURNABLE")
  ) {
    return new ValidationError(`Gagal: ${message.split(":")[0]}`);
  }
  if (message.includes("SALE_ITEM_NOT_FOUND")) {
    return new NotFoundError("Item transaksi");
  }
  if (message.includes("FORBIDDEN")) {
    return new ValidationError("Anda tidak memiliki hak akses untuk aksi ini");
  }
  return new InvariantViolationError(`Checkout gagal: ${message}`);
}

export class SupabaseSaleRepository implements ISaleRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async createSale(
    record: CreateSaleRecord
  ): Promise<Result<SaleReceipt, DomainError>> {
    const { data, error } = await this.client.rpc("create_sale", {
      p_payload: {
        idempotency_key: record.idempotencyKey,
        user_id: record.userId,
        shift_id: record.shiftId ?? null,
        customer_id: record.customerId ?? null,
        allow_negative_stock: record.allowNegativeStock ?? false,
        transaction_discount: record.transactionDiscount ?? 0,
        tax_total: record.taxTotal ?? 0,
        service_fee: record.serviceFee ?? 0,
        rounding: 0,
        items: record.items.map((item) => ({
          variant_id: item.variantId,
          qty: item.qty,
          discount: item.discount ?? 0,
        })),
        payments: record.payments.map((p) => ({
          payment_method_id: p.paymentMethodId,
          amount: p.amount,
          reference_no: p.referenceNo ?? null,
        })),
      },
    });

    if (error) {
      return err(mapRpcError(error.message));
    }
    try {
      return ok(mapReceiptJson(data as unknown as ReceiptJson));
    } catch {
      return err(new InvariantViolationError("Struk tidak dapat dibaca"));
    }
  }

  public async findReceiptById(
    id: string
  ): Promise<Result<SaleReceipt | null, DomainError>> {
    const { data, error } = await this.client.rpc("build_sale_receipt", {
      p_sale_id: id,
    });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    const json = data as unknown as ReceiptJson;
    if (!json?.sale?.id) {
      return ok(null);
    }
    try {
      return ok(mapReceiptJson(json));
    } catch {
      return err(new InvariantViolationError("Struk tidak dapat dibaca"));
    }
  }

  public async findReceiptByInvoice(
    invoiceNo: string
  ): Promise<Result<SaleReceipt | null, DomainError>> {
    const { data, error } = await this.client
      .from("sales")
      .select("id")
      .eq("invoice_no", invoiceNo)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return this.findReceiptById((data as { id: string }).id);
  }

  public async findReceiptByIdempotencyKey(
    key: string
  ): Promise<Result<SaleReceipt | null, DomainError>> {
    const { data, error } = await this.client
      .from("sales")
      .select("id")
      .eq("idempotency_key", key)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return this.findReceiptById((data as { id: string }).id);
  }

  public async voidSale(
    record: VoidSaleRecord
  ): Promise<Result<SaleReceipt, DomainError>> {
    const { data, error } = await this.client.rpc("void_sale", {
      p_sale_id: record.saleId,
      p_reason: record.reason,
    });
    if (error) {
      return err(mapRpcError(error.message));
    }
    try {
      return ok(mapReceiptJson(data as unknown as ReceiptJson));
    } catch {
      return err(new InvariantViolationError("Struk tidak dapat dibaca"));
    }
  }

  public async createReturn(
    record: CreateReturnRecord
  ): Promise<Result<CreateReturnResult, DomainError>> {
    const { data, error } = await this.client.rpc("create_return", {
      p_sale_id: record.saleId,
      p_items: record.items.map((item) => ({
        sale_item_id: item.saleItemId,
        qty: item.qty,
      })),
      p_refund_method_id: record.refundMethodId,
      p_reason: record.reason,
    });
    if (error) {
      return err(mapRpcError(error.message));
    }
    try {
      const json = data as unknown as {
        return: { id: string };
        total_refund: number | string;
        receipt: ReceiptJson;
      };
      return ok({
        returnId: json.return.id,
        totalRefund: Math.round(Number(json.total_refund)),
        receipt: mapReceiptJson(json.receipt),
      });
    } catch {
      return err(new InvariantViolationError("Data retur tidak dapat dibaca"));
    }
  }

  public async listReturns(
    filter: ReturnListFilter
  ): Promise<Result<ReturnListResult, DomainError>> {
    const page = filter.page ?? 1;
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await this.client
      .from("sale_returns")
      .select(
        "id,sale_id,reason,total_refund,created_at,sales!inner ( invoice_no ),payment_methods ( name )",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const items = (
      (data ?? []) as unknown as {
        id: string;
        sale_id: string;
        reason: string;
        total_refund: number | string;
        created_at: string;
        sales: { invoice_no: string };
        payment_methods: { name: string } | null;
      }[]
    ).map((row) => ({
      id: row.id,
      saleId: row.sale_id,
      invoiceNo: row.sales.invoice_no,
      reason: row.reason,
      totalRefund: Money.create(Math.round(Number(row.total_refund))),
      refundMethodName: row.payment_methods?.name ?? "-",
      createdAt: new Date(row.created_at),
    }));
    return ok({ items, total: count ?? 0, page, pageSize });
  }

  public async holdSale(
    record: HoldSaleRecord
  ): Promise<Result<{ saleId: string; holdNo: string }, DomainError>> {
    const { data, error } = await this.client.rpc("hold_sale", {
      p_payload: {
        user_id: record.userId,
        customer_id: record.customerId ?? null,
        items: record.items.map((item) => ({
          variant_id: item.variantId,
          qty: item.qty,
          discount: item.discount ?? 0,
        })),
        discount_total: record.discountTotal ?? 0,
        transaction_discount: record.transactionDiscount ?? 0,
        tax_total: record.taxTotal ?? 0,
        service_fee: record.serviceFee ?? 0,
      },
    });
    if (error) {
      if (error.message.includes("HOLD_LIMIT")) {
        return err(
          new ValidationError("Maksimal 5 transaksi di-hold per kasir")
        );
      }
      return err(mapRpcError(error.message));
    }
    const json = data as unknown as { sale_id: string; hold_no: string };
    return ok({ saleId: json.sale_id, holdNo: json.hold_no });
  }

  public async resumeSale(
    saleId: string,
    discard: boolean
  ): Promise<Result<ResumeData, DomainError>> {
    const { data, error } = await this.client.rpc("resume_sale", {
      p_sale_id: saleId,
      p_discard: discard,
    });
    if (error) {
      return err(mapRpcError(error.message));
    }
    try {
      const json = data as unknown as {
        sale_id: string;
        hold_no: string;
        customer_id: string | null;
        discount_total: number | string;
        items: {
          sale_item_id: string;
          variant_id: string;
          product_name: string;
          variant_name: string;
          sku: string;
          barcode: string | null;
          qty: number | string;
          discount: number | string;
          sell_price: number | string;
          cost_price: number | string;
          stock_qty: number | string;
          track_stock: boolean;
          tiers: { min_qty: number | string; price: number | string }[];
        }[];
      };
      return ok({
        saleId: json.sale_id,
        holdNo: json.hold_no,
        customerId: json.customer_id,
        discountTotal: Math.round(Number(json.discount_total)),
        items: (json.items ?? []).map((item) => ({
          saleItemId: item.sale_item_id,
          variantId: item.variant_id,
          productName: item.product_name,
          variantName: item.variant_name ?? "",
          sku: item.sku,
          barcode: item.barcode,
          qty: Number(item.qty),
          discount: Math.round(Number(item.discount)),
          sellPrice: Math.round(Number(item.sell_price)),
          costPrice: Math.round(Number(item.cost_price)),
          stockQty: Number(item.stock_qty),
          trackStock: item.track_stock,
          tiers: (item.tiers ?? []).map((t) => ({
            minQty: Math.floor(Number(t.min_qty)),
            price: Math.round(Number(t.price)),
          })),
        })),
      });
    } catch {
      return err(new InvariantViolationError("Data hold tidak dapat dibaca"));
    }
  }

  public async listHeldSales(
    userId: string
  ): Promise<Result<HeldSaleSummary[], DomainError>> {
    const { data, error } = await this.client
      .from("sales")
      .select(
        "id,invoice_no,customer_id,grand_total,created_at,sale_items ( qty )"
      )
      .eq("user_id", userId)
      .eq("status", "held")
      .order("created_at", { ascending: false });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const rows = (
      (data ?? []) as unknown as {
        id: string;
        invoice_no: string;
        customer_id: string | null;
        grand_total: number | string;
        created_at: string;
        sale_items: { qty: number | string }[];
      }[]
    ).map((row) => ({
      saleId: row.id,
      holdNo: row.invoice_no,
      customerId: row.customer_id,
      itemCount: row.sale_items.length,
      totalQty: row.sale_items.reduce((sum, i) => sum + Number(i.qty), 0),
      grandTotal: Math.round(Number(row.grand_total)),
      createdAt: new Date(row.created_at),
    }));
    return ok(rows);
  }
}

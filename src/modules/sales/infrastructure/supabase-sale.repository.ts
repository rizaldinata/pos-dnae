import {
  Sale,
  SaleItem,
  SalePayment,
  type SaleReceipt,
  type SaleStatus,
} from "@/modules/sales/domain/entities/sale";
import type {
  CreateSaleRecord,
  ISaleRepository,
} from "@/modules/sales/domain/repositories/sale.repository";
import {
  InsufficientStockError,
  InvalidPaymentMethodError,
  UnderpaidError,
} from "@/modules/sales/domain/errors";
import { Money } from "@/shared/lib/money";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
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
        tax_total: 0,
        service_fee: 0,
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
}

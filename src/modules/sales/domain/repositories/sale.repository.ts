import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { SaleReceipt } from "@/modules/sales/domain/entities/sale";

export interface CheckoutItemInput {
  variantId: string;
  qty: number;
  discount?: number;
}

export interface CheckoutPaymentInput {
  paymentMethodId: string;
  amount: number;
  referenceNo?: string | null;
}

export interface CreateSaleRecord {
  idempotencyKey: string;
  userId: string;
  shiftId?: string | null;
  customerId?: string | null;
  allowNegativeStock?: boolean;
  items: CheckoutItemInput[];
  payments: CheckoutPaymentInput[];
}

export interface ISaleRepository {
  createSale(
    record: CreateSaleRecord
  ): Promise<Result<SaleReceipt, DomainError>>;
  findReceiptById(id: string): Promise<Result<SaleReceipt | null, DomainError>>;
  findReceiptByInvoice(
    invoiceNo: string
  ): Promise<Result<SaleReceipt | null, DomainError>>;
  findReceiptByIdempotencyKey(
    key: string
  ): Promise<Result<SaleReceipt | null, DomainError>>;
}

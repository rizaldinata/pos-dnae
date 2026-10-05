import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { SaleReceipt } from "@/modules/sales/domain/entities/sale";
import type { ReturnListItem } from "@/modules/sales/domain/entities/sale-return";
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
  transactionDiscount?: number;
  taxTotal?: number;
  serviceFee?: number;
  payments: CheckoutPaymentInput[];
}

export interface VoidSaleRecord {
  saleId: string;
  reason: string;
}

export interface CreateReturnRecord {
  saleId: string;
  items: { saleItemId: string; qty: number }[];
  refundMethodId: string;
  reason: string;
}

export interface CreateReturnResult {
  returnId: string;
  totalRefund: number;
  receipt: SaleReceipt;
}

export interface ReturnListFilter {
  page?: number;
  pageSize?: number;
}

export interface ReturnListResult {
  items: ReturnListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HoldSaleItemInput {
  variantId: string;
  qty: number;
  discount?: number;
}

export interface HoldSaleRecord {
  userId: string;
  customerId?: string | null;
  items: HoldSaleItemInput[];
  discountTotal?: number;
  transactionDiscount?: number;
  taxTotal?: number;
  serviceFee?: number;
}

export interface HeldSaleSummary {
  saleId: string;
  holdNo: string;
  customerId: string | null;
  itemCount: number;
  totalQty: number;
  grandTotal: number;
  createdAt: Date;
}

export interface ResumeItem {
  saleItemId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  barcode: string | null;
  qty: number;
  discount: number;
  sellPrice: number;
  costPrice: number;
  stockQty: number;
  trackStock: boolean;
  tiers: { minQty: number; price: number }[];
}

export interface ResumeData {
  saleId: string;
  holdNo: string;
  customerId: string | null;
  discountTotal: number;
  items: ResumeItem[];
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
  voidSale(record: VoidSaleRecord): Promise<Result<SaleReceipt, DomainError>>;
  createReturn(
    record: CreateReturnRecord
  ): Promise<Result<CreateReturnResult, DomainError>>;
  listReturns(
    filter: ReturnListFilter
  ): Promise<Result<ReturnListResult, DomainError>>;
  holdSale(
    record: HoldSaleRecord
  ): Promise<Result<{ saleId: string; holdNo: string }, DomainError>>;
  resumeSale(
    saleId: string,
    discard: boolean
  ): Promise<Result<ResumeData, DomainError>>;
  listHeldSales(
    userId: string
  ): Promise<Result<HeldSaleSummary[], DomainError>>;
}

import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  GoodsReceiptInfo,
  PurchaseOrder,
  PurchaseReturnInfo,
} from "@/modules/purchasing/domain/entities/purchasing";

export interface POItemInput {
  variantId: string;
  qty: number;
  costPrice: number;
}

export interface CreatePOInput {
  supplierId: string;
  orderDate?: string;
  notes?: string;
  items: POItemInput[];
}

export interface ReceiveItemInput {
  variantId: string;
  qty: number;
  costPrice: number;
  batchNo?: string;
  expiryDate?: string | null;
}

export interface PurchaseReturnItemInput {
  variantId: string;
  qty: number;
  costPrice: number;
}

export interface POListFilter {
  supplierId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface POListResult {
  items: PurchaseOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IPurchaseOrderRepository {
  create(
    input: CreatePOInput
  ): Promise<Result<{ poId: string; poNo: string }, DomainError>>;
  findById(id: string): Promise<Result<PurchaseOrder | null, DomainError>>;
  list(filter: POListFilter): Promise<Result<POListResult, DomainError>>;
  updateDraft(
    id: string,
    input: { notes?: string; items?: POItemInput[] }
  ): Promise<Result<PurchaseOrder, DomainError>>;
  setStatus(
    id: string,
    status: "sent" | "cancelled"
  ): Promise<Result<PurchaseOrder, DomainError>>;
  receiveGoods(
    poId: string,
    items: ReceiveItemInput[],
    note?: string
  ): Promise<Result<GoodsReceiptInfo, DomainError>>;
  listReceipts(poId: string): Promise<Result<GoodsReceiptInfo[], DomainError>>;
  createReturn(
    supplierId: string,
    reason: string,
    items: PurchaseReturnItemInput[]
  ): Promise<Result<PurchaseReturnInfo, DomainError>>;
  listReturns(
    supplierId?: string
  ): Promise<Result<PurchaseReturnInfo[], DomainError>>;
}

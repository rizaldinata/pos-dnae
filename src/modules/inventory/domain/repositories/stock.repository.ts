import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  AdjustStockRecord,
  AdjustStockResult,
} from "@/modules/inventory/domain/repositories/stock-opname.repository";
import type {
  Stock,
  StockMovement,
  StockMovementType,
} from "@/modules/inventory/domain/entities/stock";
import type {
  StockOverview,
  StockStatus,
} from "@/modules/inventory/domain/services/stock-policy";

export interface StockOverviewFilter {
  query?: string;
  categoryId?: string;
  status?: StockStatus;
  page?: number;
  pageSize?: number;
}

export interface StockOverviewResult {
  items: StockOverview[];
  total: number;
  page: number;
  pageSize: number;
}

export type ExpiryStatusFilter = "expired" | "expiring";

export interface ExpiringBatchFilter {
  /** Hari sebelum kedaluwarsa yang dianggap "mendekati" (dari settings). */
  warningDays: number;
  status?: ExpiryStatusFilter;
  page?: number;
  pageSize?: number;
}

export interface ExpiringBatchItem {
  id: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  batchNo: string;
  qty: number;
  /** YYYY-MM-DD. */
  expiryDate: string;
  status: ExpiryStatusFilter;
}

export interface ExpiringBatchResult {
  items: ExpiringBatchItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StockBatchInfo {
  id: string;
  batchNo: string;
  qty: number;
  /** YYYY-MM-DD atau null (tanpa tanggal kedaluwarsa). */
  expiryDate: string | null;
}

export interface IStockRepository {
  getByVariantId(variantId: string): Promise<Result<Stock | null, DomainError>>;
  listOverview(
    filter: StockOverviewFilter
  ): Promise<Result<StockOverviewResult, DomainError>>;
  getOverviewByVariantId(
    variantId: string
  ): Promise<Result<StockOverview | null, DomainError>>;
  adjustStock(
    record: AdjustStockRecord
  ): Promise<Result<AdjustStockResult, DomainError>>;
  countLowStock(): Promise<Result<number, DomainError>>;
  /** Jumlah batch dengan qty > 0 yang sudah lewat / mendekati kedaluwarsa. */
  countExpiringBatches(
    warningDays: number
  ): Promise<Result<number, DomainError>>;
  listExpiringBatches(
    filter: ExpiringBatchFilter
  ): Promise<Result<ExpiringBatchResult, DomainError>>;
  /** Batch aktif (qty > 0) untuk satu varian, urut kedaluwarsa (FEFO). */
  listBatchesByVariant(
    variantId: string
  ): Promise<Result<StockBatchInfo[], DomainError>>;
}

export interface RecordMovementRecord {
  variantId: string;
  type: StockMovementType;
  qtyChange: number;
  refType?: string | null;
  refId?: string | null;
  note?: string;
  createdBy?: string | null;
}

export interface StockCardFilter {
  variantId: string;
  type?: StockMovementType;
  page?: number;
  pageSize?: number;
}

export interface StockCardResult {
  overview: StockOverview | null;
  movements: StockMovement[];
  total: number;
  page: number;
  pageSize: number;
  /** Batch aktif varian (Sub-PRD 4.1); diisi oleh GetStockCardUseCase. */
  batches?: StockBatchInfo[];
}

export interface IStockMovementRepository {
  create(
    record: RecordMovementRecord
  ): Promise<Result<StockMovement, DomainError>>;
  findByVariantId(
    filter: StockCardFilter
  ): Promise<Result<StockCardResult, DomainError>>;
}

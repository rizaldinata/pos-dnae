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
}

export interface IStockMovementRepository {
  create(
    record: RecordMovementRecord
  ): Promise<Result<StockMovement, DomainError>>;
  findByVariantId(
    filter: StockCardFilter
  ): Promise<Result<StockCardResult, DomainError>>;
}

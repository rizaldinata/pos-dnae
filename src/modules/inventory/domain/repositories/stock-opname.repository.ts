import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  StockOpname,
  StockOpnameDetail,
} from "@/modules/inventory/domain/entities/stock-opname";

export interface IStockOpnameRepository {
  createOpname(
    categoryId?: string | null
  ): Promise<Result<StockOpnameDetail, DomainError>>;
  findById(
    opnameId: string
  ): Promise<Result<StockOpnameDetail | null, DomainError>>;
  listOpnames(): Promise<Result<StockOpname[], DomainError>>;
  updateItem(
    opnameId: string,
    variantId: string,
    actualQty: number
  ): Promise<Result<StockOpnameDetail, DomainError>>;
  approveOpname(
    opnameId: string
  ): Promise<Result<{ adjustedItems: number }, DomainError>>;
}

export interface AdjustStockRecord {
  variantId: string;
  newQty: number;
  reason: string;
}

export interface AdjustStockResult {
  variantId: string;
  oldQty: number;
  newQty: number;
}

import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  PeriodProfitRow,
  ProductProfitRow,
  ProfitGranularity,
  ProfitSortKey,
} from "@/modules/reporting/domain/entities/advanced-report";

export interface ProductProfitQuery {
  from: string;
  to: string;
  categoryId?: string;
  sort: ProfitSortKey;
}

/** Komputasi laba dilakukan di database (SQL function, RPT-05). */
export interface IAdvancedReportRepository {
  getProfitByProduct(
    query: ProductProfitQuery
  ): Promise<Result<ProductProfitRow[], DomainError>>;
  getProfitByPeriod(
    from: string,
    to: string,
    granularity: ProfitGranularity
  ): Promise<Result<PeriodProfitRow[], DomainError>>;
}

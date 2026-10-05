import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { SalesDaySummary } from "@/modules/reporting/domain/entities/sales-summary";

export interface DateRangeQuery {
  from: string;
  to: string;
}

export interface MonthQuery {
  year: number;
  month: number;
}

export interface RecentTransaction {
  id: string;
  invoiceNo: string;
  createdAt: string;
  grandTotal: number;
  paidTotal: number;
  status: string;
}

export interface ISalesReportRepository {
  getDaily(date: string): Promise<Result<SalesDaySummary, DomainError>>;
  getByDateRange(
    query: DateRangeQuery
  ): Promise<Result<SalesDaySummary[], DomainError>>;
  getMonthly(
    query: MonthQuery
  ): Promise<Result<SalesDaySummary[], DomainError>>;
  getRecentTransactions(
    from: string,
    to: string,
    limit: number
  ): Promise<Result<RecentTransaction[], DomainError>>;
}

import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { SalesDaySummary } from "@/modules/reporting/domain/entities/sales-summary";
import type {
  CashierSalesRow,
  CategorySalesRow,
  PaymentMethodSalesRow,
  ProductSalesRow,
  StockValuationRow,
  TopProduct,
} from "@/modules/reporting/domain/entities/operational-report";

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
  getTopProducts(
    from: string,
    to: string,
    limit: number
  ): Promise<Result<TopProduct[], DomainError>>;
  getProductSales(
    from: string,
    to: string,
    categoryId?: string | null
  ): Promise<Result<ProductSalesRow[], DomainError>>;
  getCategorySales(
    from: string,
    to: string
  ): Promise<Result<CategorySalesRow[], DomainError>>;
  getCashierSales(
    from: string,
    to: string
  ): Promise<Result<CashierSalesRow[], DomainError>>;
  getPaymentMethodSales(
    from: string,
    to: string
  ): Promise<Result<PaymentMethodSalesRow[], DomainError>>;
  getStockValuation(): Promise<
    Result<{ rows: StockValuationRow[]; totalValue: number }, DomainError>
  >;
}

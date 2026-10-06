import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  CashFlowRow,
  ProfitLossSummary,
} from "@/modules/finance/domain/services/finance-policy";
import type {
  ExpenseSummaryRow,
  MonthlyProfitRow,
} from "@/modules/finance/domain/entities/finance-report";

/**
 * Akses laporan keuangan. Semua komputasi berat (arus kas, laba rugi,
 * HPP, tren bulanan) dilakukan di database lewat SQL function.
 */
export interface IFinanceReportRepository {
  /** Baris kas masuk/keluar per sumber pada periode (FIN-02). */
  getCashFlow(
    from: string,
    to: string
  ): Promise<Result<CashFlowRow[], DomainError>>;
  /** Penjualan, diskon, HPP, pengeluaran, laba (FIN-03). */
  getProfitLoss(
    from: string,
    to: string
  ): Promise<Result<ProfitLossSummary, DomainError>>;
  /** Pengeluaran per kategori pada periode. */
  getExpenseSummary(
    from: string,
    to: string
  ): Promise<Result<ExpenseSummaryRow[], DomainError>>;
  /** Laba per bulan pada rentang (maksimal 36 bulan di sisi database). */
  getMonthlyProfit(
    from: string,
    to: string
  ): Promise<Result<MonthlyProfitRow[], DomainError>>;
}

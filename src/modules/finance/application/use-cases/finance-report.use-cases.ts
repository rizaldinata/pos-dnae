import { z } from "zod";
import type { IFinanceReportRepository } from "@/modules/finance/domain/repositories/finance-report.repository";
import type {
  ExpenseSummaryRow,
  MonthlyProfitRow,
} from "@/modules/finance/domain/entities/finance-report";
import {
  FinancePolicy,
  type CashFlowSummary,
  type ProfitLossSummary,
} from "@/modules/finance/domain/services/finance-policy";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const PeriodSchema = z.object({
  dateFrom: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal mulai harus YYYY-MM-DD" }),
  dateTo: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal selesai harus YYYY-MM-DD" }),
});

export type PeriodInput = z.input<typeof PeriodSchema>;

export interface CashFlowReport {
  from: string;
  to: string;
  summary: CashFlowSummary;
}

export interface ProfitLossReport {
  from: string;
  to: string;
  summary: ProfitLossSummary;
  expensesByCategory: ExpenseSummaryRow[];
}

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

function validatePeriod(
  rawInput: PeriodInput
): Result<{ from: string; to: string }, DomainError> {
  const parsed = PeriodSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      new ValidationError(
        "Periode laporan tidak valid",
        toFieldErrors(parsed.error)
      )
    );
  }
  if (
    !FinancePolicy.isChronological(parsed.data.dateFrom, parsed.data.dateTo)
  ) {
    return err(
      new ValidationError("Tanggal mulai tidak boleh setelah selesai", {
        dateTo: ["Tanggal mulai tidak boleh setelah selesai"],
      })
    );
  }
  return ok({ from: parsed.data.dateFrom, to: parsed.data.dateTo });
}

/** Laporan kas masuk/keluar beserta saldo periode (FIN-02). */
export class GetCashFlowUseCase {
  constructor(private readonly reports: IFinanceReportRepository) {}

  public async execute(
    rawInput: PeriodInput
  ): Promise<Result<CashFlowReport, DomainError>> {
    const period = validatePeriod(rawInput);
    if (isErr(period)) {
      return err(period.error);
    }
    const rows = await this.reports.getCashFlow(
      period.data.from,
      period.data.to
    );
    if (isErr(rows)) {
      return err(rows.error);
    }
    return ok({
      from: period.data.from,
      to: period.data.to,
      summary: FinancePolicy.summarizeCashFlow(rows.data),
    });
  }
}

/** Laba rugi sederhana: penjualan - HPP - pengeluaran (FIN-03). */
export class GetProfitLossUseCase {
  constructor(private readonly reports: IFinanceReportRepository) {}

  public async execute(
    rawInput: PeriodInput
  ): Promise<Result<ProfitLossReport, DomainError>> {
    const period = validatePeriod(rawInput);
    if (isErr(period)) {
      return err(period.error);
    }
    const [summary, expenses] = await Promise.all([
      this.reports.getProfitLoss(period.data.from, period.data.to),
      this.reports.getExpenseSummary(period.data.from, period.data.to),
    ]);
    if (isErr(summary)) {
      return err(summary.error);
    }
    if (isErr(expenses)) {
      return err(expenses.error);
    }
    return ok({
      from: period.data.from,
      to: period.data.to,
      summary: {
        grossSales: Math.round(summary.data.grossSales),
        discountTotal: Math.round(summary.data.discountTotal),
        netSales: Math.round(summary.data.netSales),
        cogs: Math.round(summary.data.cogs),
        grossProfit: Math.round(summary.data.grossProfit),
        expenseTotal: Math.round(summary.data.expenseTotal),
        netProfit: Math.round(summary.data.netProfit),
      },
      expensesByCategory: expenses.data.map((row) => ({
        ...row,
        total: Math.round(row.total),
      })),
    });
  }
}

export interface ProfitTrendReport {
  from: string;
  to: string;
  months: MonthlyProfitRow[];
}

/** Tren laba per bulan untuk grafik (12 bulan terakhir hingga `dateTo`). */
export class GetProfitTrendUseCase {
  constructor(private readonly reports: IFinanceReportRepository) {}

  public async execute(
    dateTo: string
  ): Promise<Result<ProfitTrendReport, DomainError>> {
    if (!DATE_PATTERN.test(dateTo)) {
      return err(
        new ValidationError("Tanggal tidak valid", {
          dateTo: ["Tanggal harus YYYY-MM-DD"],
        })
      );
    }
    const window = FinancePolicy.monthWindow(dateTo, 12);
    const months = await this.reports.getMonthlyProfit(window.from, window.to);
    if (isErr(months)) {
      return err(months.error);
    }
    return ok({
      from: window.from,
      to: window.to,
      months: months.data.map((row) => ({
        ...row,
        netSales: Math.round(row.netSales),
        cogs: Math.round(row.cogs),
        expenseTotal: Math.round(row.expenseTotal),
        netProfit: Math.round(row.netProfit),
      })),
    });
  }
}

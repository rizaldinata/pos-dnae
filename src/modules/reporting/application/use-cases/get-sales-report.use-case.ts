import { z } from "zod";
import type {
  ISalesReportRepository,
  RecentTransaction,
} from "@/modules/reporting/domain/repositories/sales-report.repository";
import {
  sumDaySummaries,
  type SalesDaySummary,
  type SalesSummaryTotals,
} from "@/modules/reporting/domain/entities/sales-summary";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const SalesReportQuerySchema = z.object({
  mode: z.enum(["daily", "range", "monthly"], {
    error: "Mode laporan tidak valid",
  }),
  date: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal harus format YYYY-MM-DD" })
    .optional(),
  dateFrom: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal harus format YYYY-MM-DD" })
    .optional(),
  dateTo: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal harus format YYYY-MM-DD" })
    .optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
});

export type SalesReportQueryInput = z.input<typeof SalesReportQuerySchema>;

export interface SalesReport {
  mode: "daily" | "range" | "monthly";
  label: string;
  days: SalesDaySummary[];
  totals: SalesSummaryTotals;
}

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class GetRecentTransactionsUseCase {
  constructor(private readonly reports: ISalesReportRepository) {}

  public async execute(
    from: string,
    to: string,
    limit = 20
  ): Promise<Result<RecentTransaction[], DomainError>> {
    if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
      return err(new ValidationError("Rentang tanggal tidak valid"));
    }
    return this.reports.getRecentTransactions(from, to, limit);
  }
}

export class GetSalesReportUseCase {
  constructor(private readonly reports: ISalesReportRepository) {}

  public async execute(
    rawInput: SalesReportQueryInput
  ): Promise<Result<SalesReport, DomainError>> {
    const parsed = SalesReportQuerySchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Filter laporan tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const { mode } = parsed.data;

    if (mode === "daily") {
      if (!parsed.data.date) {
        return err(
          new ValidationError("Tanggal wajib diisi untuk laporan harian")
        );
      }
      const result = await this.reports.getDaily(parsed.data.date);
      if (isErr(result)) {
        return err(result.error);
      }
      const day: SalesDaySummary = { ...result.data, day: parsed.data.date };
      return ok({
        mode,
        label: parsed.data.date,
        days: [day],
        totals: sumDaySummaries([day]),
      });
    }

    if (mode === "range") {
      if (!parsed.data.dateFrom || !parsed.data.dateTo) {
        return err(new ValidationError("Rentang tanggal wajib diisi"));
      }
      if (parsed.data.dateFrom > parsed.data.dateTo) {
        return err(
          new ValidationError(
            "Tanggal mulai tidak boleh setelah tanggal selesai"
          )
        );
      }
      const result = await this.reports.getByDateRange({
        from: parsed.data.dateFrom,
        to: parsed.data.dateTo,
      });
      if (isErr(result)) {
        return err(result.error);
      }
      return ok({
        mode,
        label: `${parsed.data.dateFrom} s/d ${parsed.data.dateTo}`,
        days: result.data,
        totals: sumDaySummaries(result.data),
      });
    }

    if (parsed.data.year === undefined || parsed.data.month === undefined) {
      return err(new ValidationError("Bulan dan tahun wajib diisi"));
    }
    const result = await this.reports.getMonthly({
      year: parsed.data.year,
      month: parsed.data.month,
    });
    if (isErr(result)) {
      return err(result.error);
    }
    return ok({
      mode,
      label: `${parsed.data.year}-${String(parsed.data.month).padStart(2, "0")}`,
      days: result.data,
      totals: sumDaySummaries(result.data),
    });
  }
}

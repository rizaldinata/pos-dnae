import { z } from "zod";
import type {
  IAdvancedReportRepository,
  ProductProfitQuery,
} from "@/modules/reporting/domain/repositories/advanced-report.repository";
import {
  deltaPercent,
  sumPeriodRows,
  type PeriodProfitRow,
  type PeriodTotals,
  type ProfitGranularity,
  type ProductProfitRow,
} from "@/modules/reporting/domain/entities/advanced-report";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_ERROR = { error: "Tanggal harus format YYYY-MM-DD" };

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

function parseOrError<T extends z.ZodType>(
  schema: T,
  rawInput: unknown
): Result<z.output<T>, DomainError> {
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      new ValidationError(
        "Filter laporan tidak valid",
        toFieldErrors(parsed.error)
      )
    );
  }
  return ok(parsed.data);
}

function chronological(from: string, to: string): boolean {
  return from <= to;
}

const DateRangeSchema = z
  .object({
    dateFrom: z.string().regex(DATE_PATTERN, DATE_ERROR),
    dateTo: z.string().regex(DATE_PATTERN, DATE_ERROR),
  })
  .refine((v) => chronological(v.dateFrom, v.dateTo), {
    error: "Tanggal awal harus sebelum tanggal akhir",
  });

export const ProductProfitQuerySchema = DateRangeSchema.extend({
  categoryId: z.uuid({ error: "Kategori tidak valid" }).nullish(),
  sort: z
    .enum(["profit", "margin", "qty", "revenue", "name"], {
      error: "Urutan tidak valid",
    })
    .optional()
    .default("profit"),
});

export type ProductProfitQueryInput = z.input<typeof ProductProfitQuerySchema>;

export const PeriodProfitQuerySchema = DateRangeSchema.extend({
  granularity: z
    .enum(["day", "week", "month"], { error: "Granularitas tidak valid" })
    .optional()
    .default("day"),
});

export type PeriodProfitQueryInput = z.input<typeof PeriodProfitQuerySchema>;

/** Batas jumlah bucket per granularitas, selaras dengan backstop di SQL. */
const MAX_RANGE_DAYS: Record<ProfitGranularity, number> = {
  day: 92,
  week: 182,
  month: 730,
};

const GRANULARITY_LABEL: Record<ProfitGranularity, string> = {
  day: "harian",
  week: "mingguan",
  month: "bulanan",
};

function parseISO(iso: string): number {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Selisih hari antar dua tanggal YYYY-MM-DD (matematika UTC, bebas DST). */
function diffDays(from: string, to: string): number {
  return Math.round((parseISO(to) - parseISO(from)) / 86_400_000);
}

function addDaysISO(iso: string, days: number): string {
  return new Date(parseISO(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Jendela periode pembanding: rentang berdurasi sama tepat sebelum `from`. */
export function previousRange(
  from: string,
  to: string
): {
  from: string;
  to: string;
} {
  const length = diffDays(from, to) + 1;
  return { from: addDaysISO(from, -length), to: addDaysISO(from, -1) };
}

export interface ProductProfitReport {
  from: string;
  to: string;
  categoryId: string | null;
  sort: ProductProfitQuery["sort"];
  rows: ProductProfitRow[];
}

export interface PeriodProfitReport {
  from: string;
  to: string;
  granularity: ProfitGranularity;
  rows: PeriodProfitRow[];
  totals: PeriodTotals;
  previous: {
    from: string;
    to: string;
    rows: PeriodProfitRow[];
    totals: PeriodTotals;
  };
  deltas: {
    netSales: number | null;
    netProfit: number | null;
  };
}

export class GetProductProfitUseCase {
  constructor(private readonly reports: IAdvancedReportRepository) {}

  public async execute(
    rawInput: ProductProfitQueryInput
  ): Promise<Result<ProductProfitReport, DomainError>> {
    const parsedResult = parseOrError(ProductProfitQuerySchema, rawInput);
    if (isErr(parsedResult)) {
      return err(parsedResult.error);
    }
    const { dateFrom, dateTo, categoryId, sort } = parsedResult.data;
    const result = await this.reports.getProfitByProduct({
      from: dateFrom,
      to: dateTo,
      categoryId: categoryId ?? undefined,
      sort,
    });
    if (isErr(result)) {
      return err(result.error);
    }
    return ok({
      from: dateFrom,
      to: dateTo,
      categoryId: categoryId ?? null,
      sort,
      rows: result.data,
    });
  }
}

export class GetPeriodProfitUseCase {
  constructor(private readonly reports: IAdvancedReportRepository) {}

  public async execute(
    rawInput: PeriodProfitQueryInput
  ): Promise<Result<PeriodProfitReport, DomainError>> {
    const parsedResult = parseOrError(PeriodProfitQuerySchema, rawInput);
    if (isErr(parsedResult)) {
      return err(parsedResult.error);
    }
    const { dateFrom, dateTo, granularity } = parsedResult.data;

    const span = diffDays(dateFrom, dateTo) + 1;
    const maxDays = MAX_RANGE_DAYS[granularity];
    if (span > maxDays) {
      return err(
        new ValidationError(
          `Rentang maksimal ${maxDays} hari untuk tampilan ${GRANULARITY_LABEL[granularity]}`,
          {}
        )
      );
    }

    const prev = previousRange(dateFrom, dateTo);
    const [rowsResult, previousResult] = await Promise.all([
      this.reports.getProfitByPeriod(dateFrom, dateTo, granularity),
      this.reports.getProfitByPeriod(prev.from, prev.to, granularity),
    ]);
    if (isErr(rowsResult)) {
      return err(rowsResult.error);
    }
    if (isErr(previousResult)) {
      return err(previousResult.error);
    }

    const totals = sumPeriodRows(rowsResult.data);
    const previousTotals = sumPeriodRows(previousResult.data);
    return ok({
      from: dateFrom,
      to: dateTo,
      granularity,
      rows: rowsResult.data,
      totals,
      previous: {
        from: prev.from,
        to: prev.to,
        rows: previousResult.data,
        totals: previousTotals,
      },
      deltas: {
        netSales: deltaPercent(totals.netSales, previousTotals.netSales),
        netProfit: deltaPercent(totals.netProfit, previousTotals.netProfit),
      },
    });
  }
}

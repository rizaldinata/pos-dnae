import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  DateRangeQuery,
  ISalesReportRepository,
  MonthQuery,
  RecentTransaction,
} from "@/modules/reporting/domain/repositories/sales-report.repository";
import type { SalesDaySummary } from "@/modules/reporting/domain/entities/sales-summary";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

interface DayRow {
  day: string;
  transactions: number | string;
  gross_sales: number | string;
  discount_total: number | string;
  net_sales: number | string;
  items_sold: number | string;
}

function mapDayRow(row: DayRow): SalesDaySummary {
  return {
    day: String(row.day).slice(0, 10),
    transactions: Number(row.transactions),
    grossSales: Math.round(Number(row.gross_sales)),
    discountTotal: Math.round(Number(row.discount_total)),
    netSales: Math.round(Number(row.net_sales)),
    itemsSold: Number(row.items_sold),
  };
}

export class SupabaseSalesReportRepository implements ISalesReportRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async getDaily(
    date: string
  ): Promise<Result<SalesDaySummary, DomainError>> {
    const { data, error } = await this.client.rpc("daily_sales_summary", {
      p_date: date,
    });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      Omit<DayRow, "day"> | null | undefined;
    if (!row) {
      return err(
        new InvariantViolationError("Laporan harian tidak dapat dibaca")
      );
    }
    return ok({
      day: date,
      transactions: Number(row.transactions),
      grossSales: Math.round(Number(row.gross_sales)),
      discountTotal: Math.round(Number(row.discount_total)),
      netSales: Math.round(Number(row.net_sales)),
      itemsSold: Number(row.items_sold),
    });
  }

  public async getByDateRange(
    query: DateRangeQuery
  ): Promise<Result<SalesDaySummary[], DomainError>> {
    const { data, error } = await this.client.rpc("sales_by_date_range", {
      p_from: query.from,
      p_to: query.to,
    });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(((data ?? []) as unknown as DayRow[]).map(mapDayRow));
  }

  public async getMonthly(
    query: MonthQuery
  ): Promise<Result<SalesDaySummary[], DomainError>> {
    const { data, error } = await this.client.rpc("monthly_sales_summary", {
      p_year: query.year,
      p_month: query.month,
    });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(((data ?? []) as unknown as DayRow[]).map(mapDayRow));
  }

  public async getRecentTransactions(
    from: string,
    to: string,
    limit: number
  ): Promise<Result<RecentTransaction[], DomainError>> {
    const { data, error } = await this.client
      .from("sales")
      .select("id,invoice_no,created_at,grand_total,paid_total,status")
      .gte("created_at", `${from}T00:00:00+07:00`)
      .lte("created_at", `${to}T23:59:59.999+07:00`)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const rows = (
      (data ?? []) as {
        id: string;
        invoice_no: string;
        created_at: string;
        grand_total: number | string;
        paid_total: number | string;
        status: string;
      }[]
    ).map((row) => ({
      id: row.id,
      invoiceNo: row.invoice_no,
      createdAt: row.created_at,
      grandTotal: Math.round(Number(row.grand_total)),
      paidTotal: Math.round(Number(row.paid_total)),
      status: row.status,
    }));
    return ok(rows);
  }
}

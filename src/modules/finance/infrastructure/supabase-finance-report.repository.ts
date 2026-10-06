import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type { IFinanceReportRepository } from "@/modules/finance/domain/repositories/finance-report.repository";
import type {
  CashFlowRow,
  ProfitLossSummary,
} from "@/modules/finance/domain/services/finance-policy";
import type {
  ExpenseSummaryRow,
  MonthlyProfitRow,
} from "@/modules/finance/domain/entities/finance-report";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  AuthorizationError,
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

type CashFlowRowDb =
  Database["public"]["Functions"]["cash_flow_report"]["Returns"][number];
type ProfitLossRowDb =
  Database["public"]["Functions"]["profit_loss_report"]["Returns"][number];
type ExpenseSummaryRowDb =
  Database["public"]["Functions"]["expense_summary"]["Returns"][number];
type MonthlyProfitRowDb =
  Database["public"]["Functions"]["profit_loss_monthly"]["Returns"][number];

function rpcError(message: string): DomainError {
  if (message.startsWith("FORBIDDEN")) {
    return new AuthorizationError(
      "Anda tidak memiliki akses untuk laporan ini"
    );
  }
  return new InvariantViolationError(`Database error: ${message}`);
}

export class SupabaseFinanceReportRepository implements IFinanceReportRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async getCashFlow(
    from: string,
    to: string
  ): Promise<Result<CashFlowRow[], DomainError>> {
    const { data, error } = await this.client.rpc("cash_flow_report", {
      p_from: from,
      p_to: to,
    });
    if (error) {
      return err(rpcError(error.message));
    }
    const rows = (data ?? []) as unknown as CashFlowRowDb[];
    return ok(
      rows.map((row) => ({
        direction:
          row.flow_direction === "out" ? ("out" as const) : ("in" as const),
        source: String(row.flow_source),
        label: String(row.flow_label),
        entries: Number(row.entries),
        amount: Math.round(Number(row.total)),
      }))
    );
  }

  public async getProfitLoss(
    from: string,
    to: string
  ): Promise<Result<ProfitLossSummary, DomainError>> {
    const { data, error } = await this.client.rpc("profit_loss_report", {
      p_from: from,
      p_to: to,
    });
    if (error) {
      return err(rpcError(error.message));
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      ProfitLossRowDb | null | undefined;
    if (!row) {
      return err(
        new InvariantViolationError("Laporan laba rugi tidak dapat dibaca")
      );
    }
    return ok({
      grossSales: Math.round(Number(row.gross_sales)),
      discountTotal: Math.round(Number(row.discount_total)),
      netSales: Math.round(Number(row.net_sales)),
      cogs: Math.round(Number(row.cogs)),
      grossProfit: Math.round(Number(row.gross_profit)),
      expenseTotal: Math.round(Number(row.expense_total)),
      netProfit: Math.round(Number(row.net_profit)),
    });
  }

  public async getExpenseSummary(
    from: string,
    to: string
  ): Promise<Result<ExpenseSummaryRow[], DomainError>> {
    const { data, error } = await this.client.rpc("expense_summary", {
      p_from: from,
      p_to: to,
    });
    if (error) {
      return err(rpcError(error.message));
    }
    const rows = (data ?? []) as unknown as ExpenseSummaryRowDb[];
    return ok(
      rows.map((row) => ({
        categoryId: row.category_id,
        categoryName: String(row.category_name),
        entries: Number(row.entries),
        total: Math.round(Number(row.total)),
      }))
    );
  }

  public async getMonthlyProfit(
    from: string,
    to: string
  ): Promise<Result<MonthlyProfitRow[], DomainError>> {
    const { data, error } = await this.client.rpc("profit_loss_monthly", {
      p_from: from,
      p_to: to,
    });
    if (error) {
      return err(rpcError(error.message));
    }
    const rows = (data ?? []) as unknown as MonthlyProfitRowDb[];
    return ok(
      rows.map((row) => ({
        monthStart: String(row.month_start).slice(0, 10),
        netSales: Math.round(Number(row.net_sales)),
        cogs: Math.round(Number(row.cogs)),
        expenseTotal: Math.round(Number(row.expense_total)),
        netProfit: Math.round(Number(row.net_profit)),
      }))
    );
  }
}

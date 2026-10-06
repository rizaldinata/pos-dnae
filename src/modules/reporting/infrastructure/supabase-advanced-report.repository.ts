import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  IAdvancedReportRepository,
  ProductProfitQuery,
} from "@/modules/reporting/domain/repositories/advanced-report.repository";
import type {
  PeriodProfitRow,
  ProductProfitRow,
  ProfitGranularity,
} from "@/modules/reporting/domain/entities/advanced-report";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  AuthorizationError,
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

type ProductProfitRowDb =
  Database["public"]["Functions"]["profit_by_product"]["Returns"][number];
type PeriodProfitRowDb =
  Database["public"]["Functions"]["profit_by_period"]["Returns"][number];

function rpcError(message: string): DomainError {
  if (message.startsWith("FORBIDDEN")) {
    return new AuthorizationError(
      "Anda tidak memiliki akses untuk laporan ini"
    );
  }
  return new InvariantViolationError(`Database error: ${message}`);
}

function mapProductRow(row: ProductProfitRowDb): ProductProfitRow {
  return {
    productId: row.product_id,
    productName: row.product_name,
    qtySold: Math.round(Number(row.qty_sold) * 1000) / 1000,
    revenue: Math.round(Number(row.revenue)),
    cogs: Math.round(Number(row.cogs)),
    profit: Math.round(Number(row.profit)),
    marginPercent: Number(row.margin_percent),
  };
}

function mapPeriodRow(row: PeriodProfitRowDb): PeriodProfitRow {
  return {
    periodStart: String(row.period_start).slice(0, 10),
    netSales: Math.round(Number(row.net_sales)),
    cogs: Math.round(Number(row.cogs)),
    expenseTotal: Math.round(Number(row.expense_total)),
    netProfit: Math.round(Number(row.net_profit)),
  };
}

export class SupabaseAdvancedReportRepository implements IAdvancedReportRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async getProfitByProduct(
    query: ProductProfitQuery
  ): Promise<Result<ProductProfitRow[], DomainError>> {
    const { data, error } = await this.client.rpc("profit_by_product", {
      p_from: query.from,
      p_to: query.to,
      p_category_id: query.categoryId ?? undefined,
      p_sort: query.sort,
    });
    if (error) {
      return err(rpcError(error.message));
    }
    return ok((data ?? []).map(mapProductRow));
  }

  public async getProfitByPeriod(
    from: string,
    to: string,
    granularity: ProfitGranularity
  ): Promise<Result<PeriodProfitRow[], DomainError>> {
    const { data, error } = await this.client.rpc("profit_by_period", {
      p_from: from,
      p_to: to,
      p_granularity: granularity,
    });
    if (error) {
      return err(rpcError(error.message));
    }
    return ok((data ?? []).map(mapPeriodRow));
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  DateRangeQuery,
  ISalesReportRepository,
  MonthQuery,
  RecentTransaction,
} from "@/modules/reporting/domain/repositories/sales-report.repository";
import type {
  CashierSalesRow,
  CategorySalesRow,
  PaymentMethodSalesRow,
  ProductSalesRow,
  StockValuationRow,
  TopProduct,
} from "@/modules/reporting/domain/entities/operational-report";
import { withShare } from "@/modules/reporting/domain/entities/operational-report";
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

  public async getTopProducts(
    from: string,
    to: string,
    limit: number
  ): Promise<Result<TopProduct[], DomainError>> {
    const { data, error } = await this.client.rpc("top_products", {
      p_from: from,
      p_to: to,
      p_limit: Math.min(Math.max(limit, 1), 50),
    });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const rows = (
      (data ?? []) as unknown as {
        product_id: string;
        product_name: string;
        qty_sold: number | string;
        revenue: number | string;
      }[]
    ).map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      qtySold: Number(row.qty_sold),
      revenue: Math.round(Number(row.revenue)),
    }));
    return ok(rows);
  }

  public async getProductSales(
    from: string,
    to: string,
    categoryId?: string | null
  ): Promise<Result<ProductSalesRow[], DomainError>> {
    const { data, error } = await this.client.rpc("sales_by_product", {
      p_from: from,
      p_to: to,
      p_category_id: categoryId ?? undefined,
    });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const rows = (
      (data ?? []) as unknown as {
        product_id: string | null;
        product_name: string | null;
        variant_id: string | null;
        variant_name: string | null;
        sku: string | null;
        qty_sold: number | string;
        revenue: number | string;
        avg_price: number | string;
      }[]
    ).map((row) => ({
      productId: row.product_id,
      productName: row.product_name ?? "-",
      variantId: row.variant_id,
      variantName: row.variant_name ?? "",
      sku: row.sku ?? "",
      qtySold: Number(row.qty_sold),
      revenue: Math.round(Number(row.revenue)),
      avgPrice: Math.round(Number(row.avg_price)),
    }));
    return ok(rows);
  }

  public async getCategorySales(
    from: string,
    to: string
  ): Promise<Result<CategorySalesRow[], DomainError>> {
    const { data, error } = await this.client.rpc("sales_by_category", {
      p_from: from,
      p_to: to,
    });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const rows = (
      (data ?? []) as unknown as {
        category_id: string | null;
        category_name: string;
        qty_sold: number | string;
        revenue: number | string;
      }[]
    ).map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      qtySold: Number(row.qty_sold),
      revenue: Math.round(Number(row.revenue)),
      sharePercent: 0,
    }));
    return ok(withShare(rows));
  }

  public async getCashierSales(
    from: string,
    to: string
  ): Promise<Result<CashierSalesRow[], DomainError>> {
    const { data, error } = await this.client.rpc("sales_by_cashier", {
      p_from: from,
      p_to: to,
    });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const rows = (
      (data ?? []) as unknown as {
        user_id: string;
        cashier_name: string;
        transactions: number | string;
        revenue: number | string;
        avg_per_transaction: number | string;
      }[]
    ).map((row) => ({
      userId: row.user_id,
      cashierName: row.cashier_name,
      transactions: Number(row.transactions),
      revenue: Math.round(Number(row.revenue)),
      avgPerTransaction: Math.round(Number(row.avg_per_transaction)),
    }));
    return ok(rows);
  }

  public async getPaymentMethodSales(
    from: string,
    to: string
  ): Promise<Result<PaymentMethodSalesRow[], DomainError>> {
    const { data, error } = await this.client.rpc("sales_by_payment_method", {
      p_from: from,
      p_to: to,
    });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const rows = (
      (data ?? []) as unknown as {
        method_name: string;
        method_type: string;
        transactions: number | string;
        total: number | string;
      }[]
    ).map((row) => ({
      methodName: row.method_name,
      methodType: row.method_type,
      transactions: Number(row.transactions),
      total: Math.round(Number(row.total)),
      sharePercent: 0,
    }));
    return ok(
      withShare(rows.map((r) => ({ ...r, revenue: r.total }))).map((r) => ({
        methodName: r.methodName,
        methodType: r.methodType,
        transactions: r.transactions,
        total: r.total,
        sharePercent: r.sharePercent,
      }))
    );
  }

  public async getStockValuation(): Promise<
    Result<{ rows: StockValuationRow[]; totalValue: number }, DomainError>
  > {
    const { data, error } = await this.client.rpc("stock_valuation");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const rows = (
      (data ?? []) as unknown as {
        variant_id: string;
        product_name: string;
        variant_name: string;
        sku: string;
        qty: number | string;
        cost_price: number | string;
        stock_value: number | string;
      }[]
    ).map((row) => ({
      variantId: row.variant_id,
      productName: row.product_name,
      variantName: row.variant_name ?? "",
      sku: row.sku,
      qty: Number(row.qty),
      costPrice: Math.round(Number(row.cost_price)),
      stockValue: Math.round(Number(row.stock_value)),
    }));
    return ok({
      rows,
      totalValue: rows.reduce((sum, r) => sum + r.stockValue, 0),
    });
  }
}

import { z } from "zod";
import type { ISalesReportRepository } from "@/modules/reporting/domain/repositories/sales-report.repository";
import type {
  CashierSalesRow,
  CategorySalesRow,
  PaymentMethodSalesRow,
  ProductSalesRow,
  StockValuationRow,
  TopProduct,
} from "@/modules/reporting/domain/entities/operational-report";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const OperationalReportQuerySchema = z.object({
  dateFrom: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal harus format YYYY-MM-DD" }),
  dateTo: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal harus format YYYY-MM-DD" }),
  categoryId: z.uuid({ error: "ID kategori tidak valid" }).nullish(),
});

export type OperationalReportQueryInput = z.input<
  typeof OperationalReportQuerySchema
>;

export interface OperationalReport {
  from: string;
  to: string;
  topProducts: TopProduct[];
  productSales: ProductSalesRow[];
  categorySales: CategorySalesRow[];
  cashierSales: CashierSalesRow[];
  paymentMethodSales: PaymentMethodSalesRow[];
}

export class GetOperationalReportUseCase {
  constructor(private readonly reports: ISalesReportRepository) {}

  public async execute(
    rawInput: OperationalReportQueryInput
  ): Promise<Result<OperationalReport, DomainError>> {
    const parsed = OperationalReportQuerySchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return err(
        new ValidationError("Filter laporan tidak valid", fieldErrors)
      );
    }
    if (parsed.data.dateFrom > parsed.data.dateTo) {
      return err(
        new ValidationError("Tanggal mulai tidak boleh setelah tanggal selesai")
      );
    }
    const { dateFrom: from, dateTo: to } = parsed.data;

    const [top, products, categories, cashiers, methods] = await Promise.all([
      this.reports.getTopProducts(from, to, 10),
      this.reports.getProductSales(from, to, parsed.data.categoryId ?? null),
      this.reports.getCategorySales(from, to),
      this.reports.getCashierSales(from, to),
      this.reports.getPaymentMethodSales(from, to),
    ]);

    if (isErr(top)) {
      return err(top.error);
    }
    if (isErr(products)) {
      return err(products.error);
    }
    if (isErr(categories)) {
      return err(categories.error);
    }
    if (isErr(cashiers)) {
      return err(cashiers.error);
    }
    if (isErr(methods)) {
      return err(methods.error);
    }
    return ok({
      from,
      to,
      topProducts: top.data,
      productSales: products.data,
      categorySales: categories.data,
      cashierSales: cashiers.data,
      paymentMethodSales: methods.data,
    });
  }
}

export class GetStockValuationUseCase {
  constructor(private readonly reports: ISalesReportRepository) {}

  public async execute(): Promise<
    Result<{ rows: StockValuationRow[]; totalValue: number }, DomainError>
  > {
    return this.reports.getStockValuation();
  }
}

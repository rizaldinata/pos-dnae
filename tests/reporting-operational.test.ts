import { describe, expect, it } from "vitest";
import { GetOperationalReportUseCase } from "@/modules/reporting/application/use-cases/operational-report.use-cases";
import { GetStockValuationUseCase } from "@/modules/reporting/application/use-cases/operational-report.use-cases";
import type { ISalesReportRepository } from "@/modules/reporting/domain/repositories/sales-report.repository";
import { withShare } from "@/modules/reporting/domain/entities/operational-report";
import { ValidationError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";

function setup() {
  const repo: ISalesReportRepository = {
    getDaily: async (date) =>
      ok({
        day: date,
        transactions: 1,
        grossSales: 100,
        discountTotal: 0,
        netSales: 100,
        itemsSold: 1,
      }),
    getByDateRange: async () => ok([]),
    getMonthly: async () => ok([]),
    getRecentTransactions: async () => ok([]),
    getTopProducts: async () =>
      ok([{ productId: "p-1", productName: "A", qtySold: 5, revenue: 50000 }]),
    getProductSales: async () => ok([]),
    getCategorySales: async () =>
      ok([
        {
          categoryId: null,
          categoryName: "X",
          qtySold: 5,
          revenue: 50000,
          sharePercent: 0,
        },
      ]),
    getCashierSales: async () =>
      ok([
        {
          userId: "u-1",
          cashierName: "Kasir",
          transactions: 2,
          revenue: 50000,
          avgPerTransaction: 25000,
        },
      ]),
    getPaymentMethodSales: async () =>
      ok([
        {
          methodName: "Tunai",
          methodType: "cash",
          transactions: 2,
          total: 50000,
          sharePercent: 0,
        },
      ]),
    getStockValuation: async () => ok({ rows: [], totalValue: 0 }),
  };
  return {
    operational: new GetOperationalReportUseCase(repo),
    valuation: new GetStockValuationUseCase(repo),
  };
}

describe("GetOperationalReportUseCase", () => {
  it("menggabungkan semua laporan periode", async () => {
    const { operational } = setup();
    const result = await operational.execute({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-05",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topProducts).toHaveLength(1);
      expect(result.data.cashierSales[0]?.cashierName).toBe("Kasir");
      expect(result.data.paymentMethodSales[0]?.methodName).toBe("Tunai");
    }
  });

  it("menolak rentang terbalik", async () => {
    const { operational } = setup();
    const result = await operational.execute({
      dateFrom: "2026-10-05",
      dateTo: "2026-10-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });
});

describe("GetStockValuationUseCase", () => {
  it("meneruskan total nilai", async () => {
    const { valuation } = setup();
    const result = await valuation.execute();
    expect(result.success).toBe(true);
  });
});

describe("withShare", () => {
  it("menghitung kontribusi persen", () => {
    const rows = withShare([{ revenue: 75000 }, { revenue: 25000 }]);
    expect(rows[0]?.sharePercent).toBe(75);
    expect(rows[1]?.sharePercent).toBe(25);
  });

  it("0 bila total 0", () => {
    expect(withShare([])).toEqual([]);
    expect(withShare([{ revenue: 0 }])[0]?.sharePercent).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { sumDaySummaries } from "@/modules/reporting/domain/entities/sales-summary";
import { GetSalesReportUseCase } from "@/modules/reporting/application/use-cases/get-sales-report.use-case";
import type { ISalesReportRepository } from "@/modules/reporting/domain/repositories/sales-report.repository";
import type { SalesDaySummary } from "@/modules/reporting/domain/entities/sales-summary";
import { ValidationError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";

function makeDay(day: string, net: number, trx: number): SalesDaySummary {
  return {
    day,
    transactions: trx,
    grossSales: net,
    discountTotal: 0,
    netSales: net,
    itemsSold: trx,
  };
}

describe("sumDaySummaries", () => {
  it("menjumlahkan dan menghitung rata-rata", () => {
    const totals = sumDaySummaries([
      makeDay("2026-10-01", 10000, 2),
      makeDay("2026-10-02", 20000, 1),
    ]);
    expect(totals.transactions).toBe(3);
    expect(totals.netSales).toBe(30000);
    expect(totals.averagePerTransaction).toBe(10000);
    expect(totals.itemsSold).toBe(3);
  });

  it("rata-rata 0 bila tanpa transaksi", () => {
    const totals = sumDaySummaries([]);
    expect(totals.averagePerTransaction).toBe(0);
    expect(totals.netSales).toBe(0);
  });
});

describe("GetSalesReportUseCase", () => {
  function setup(days: SalesDaySummary[]) {
    const repo: ISalesReportRepository = {
      getDaily: async (date) => ok({ ...makeDay(date, 5000, 1) }),
      getByDateRange: async () => ok(days),
      getMonthly: async () => ok(days),
      getRecentTransactions: async () => ok([]),
    };
    return new GetSalesReportUseCase(repo);
  }

  it("mode harian memakai tanggal yang diminta", async () => {
    const useCase = setup([]);
    const result = await useCase.execute({ mode: "daily", date: "2026-10-05" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.days).toHaveLength(1);
      expect(result.data.days[0]?.day).toBe("2026-10-05");
      expect(result.data.totals.netSales).toBe(5000);
    }
  });

  it("mode rentang menjumlahkan semua hari", async () => {
    const useCase = setup([
      makeDay("2026-10-01", 10000, 2),
      makeDay("2026-10-02", 20000, 1),
    ]);
    const result = await useCase.execute({
      mode: "range",
      dateFrom: "2026-10-01",
      dateTo: "2026-10-02",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totals.transactions).toBe(3);
      expect(result.data.totals.netSales).toBe(30000);
    }
  });

  it("menolak rentang terbalik", async () => {
    const useCase = setup([]);
    const result = await useCase.execute({
      mode: "range",
      dateFrom: "2026-10-05",
      dateTo: "2026-10-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("menolak tanggal tanpa format", async () => {
    const useCase = setup([]);
    const result = await useCase.execute({ mode: "daily", date: "05-10-2026" });
    expect(result.success).toBe(false);
  });

  it("mode bulanan butuh tahun dan bulan", async () => {
    const useCase = setup([]);
    const result = await useCase.execute({ mode: "monthly" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });
});

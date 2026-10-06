import { describe, expect, it } from "vitest";
import {
  GetPeriodProfitUseCase,
  GetProductProfitUseCase,
  previousRange,
} from "@/modules/reporting/application/use-cases/advanced-report.use-cases";
import {
  deltaPercent,
  sumPeriodRows,
  type PeriodProfitRow,
  type ProductProfitRow,
} from "@/modules/reporting/domain/entities/advanced-report";
import type {
  IAdvancedReportRepository,
  ProductProfitQuery,
} from "@/modules/reporting/domain/repositories/advanced-report.repository";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, ok, type Result } from "@/shared/kernel/result";

const PRODUCT: ProductProfitRow = {
  productId: "20000000-0000-4000-8000-000000000001",
  productName: "Kopi Susu",
  qtySold: 12,
  revenue: 120000,
  cogs: 72000,
  profit: 48000,
  marginPercent: 40,
};

function periodRow(periodStart: string, netProfit: number): PeriodProfitRow {
  return {
    periodStart,
    netSales: 1000,
    cogs: 400,
    expenseTotal: 100,
    netProfit,
  };
}

interface SetupOptions {
  productError?: DomainError;
  periodError?: DomainError;
  periodRows?: (from: string) => PeriodProfitRow[];
}

function setup(options: SetupOptions = {}) {
  const calls = {
    product: [] as ProductProfitQuery[],
    period: [] as Array<{ from: string; to: string; grain: string }>,
  };

  const repo: IAdvancedReportRepository = {
    getProfitByProduct: async (
      query
    ): Promise<Result<ProductProfitRow[], DomainError>> => {
      calls.product.push(query);
      if (options.productError) {
        return err(options.productError);
      }
      return ok([PRODUCT]);
    },
    getProfitByPeriod: async (
      from,
      to,
      grain
    ): Promise<Result<PeriodProfitRow[], DomainError>> => {
      calls.period.push({ from, to, grain });
      if (options.periodError) {
        return err(options.periodError);
      }
      return ok(options.periodRows?.(from) ?? [periodRow(from, 500)]);
    },
  };

  return {
    calls,
    product: new GetProductProfitUseCase(repo),
    period: new GetPeriodProfitUseCase(repo),
  };
}

describe("GetProductProfitUseCase", () => {
  it("memetakan filter ke query SQL dengan sort default profit", async () => {
    const { product, calls } = setup();
    const result = await product.execute({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-06",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows).toEqual([PRODUCT]);
      expect(result.data.sort).toBe("profit");
      expect(result.data.categoryId).toBeNull();
    }
    expect(calls.product).toEqual([
      {
        from: "2026-10-01",
        to: "2026-10-06",
        categoryId: undefined,
        sort: "profit",
      },
    ]);
  });

  it("meneruskan kategori dan urutan yang dipilih", async () => {
    const { product, calls } = setup();
    const result = await product.execute({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-06",
      categoryId: "30000000-0000-4000-8000-000000000001",
      sort: "margin",
    });

    expect(result.success).toBe(true);
    expect(calls.product[0]?.sort).toBe("margin");
    expect(calls.product[0]?.categoryId).toBe(
      "30000000-0000-4000-8000-000000000001"
    );
  });

  it("menolak format tanggal yang salah", async () => {
    const { product } = setup();
    const result = await product.execute({
      dateFrom: "01-10-2026",
      dateTo: "2026-10-06",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("menolak rentang terbalik", async () => {
    const { product } = setup();
    const result = await product.execute({
      dateFrom: "2026-10-06",
      dateTo: "2026-10-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("menolak kategori yang bukan uuid", async () => {
    const { product } = setup();
    const result = await product.execute({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-06",
      categoryId: "bukan-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("meneruskan error dari repository", async () => {
    const error = new ValidationError("gagal", {});
    const { product } = setup({ productError: error });
    const result = await product.execute({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-06",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(error);
    }
  });
});

describe("GetPeriodProfitUseCase", () => {
  it("memanggil repo untuk periode saat ini dan periode pembanding", async () => {
    const { period, calls } = setup({
      periodRows: (from) => [
        periodRow(from, from.startsWith("2026-09") ? 400 : 600),
      ],
    });
    const result = await period.execute({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-30",
      granularity: "day",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totals.netProfit).toBe(600);
      expect(result.data.previous.from).toBe("2026-09-01");
      expect(result.data.previous.to).toBe("2026-09-30");
      expect(result.data.previous.totals.netProfit).toBe(400);
      expect(result.data.deltas.netProfit).toBe(50);
    }
    expect(calls.period).toEqual([
      { from: "2026-10-01", to: "2026-10-30", grain: "day" },
      { from: "2026-09-01", to: "2026-09-30", grain: "day" },
    ]);
  });

  it("mengembalikan delta null saat periode pembanding nol", async () => {
    const { period } = setup({
      periodRows: (from) => [
        periodRow(from, from.startsWith("2026-09") ? 0 : 500),
      ],
    });
    const result = await period.execute({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-30",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.previous.totals.netProfit).toBe(0);
      expect(result.data.deltas.netProfit).toBeNull();
    }
  });

  it("menolak rentang harian lebih dari 92 hari", async () => {
    const { period, calls } = setup();
    const result = await period.execute({
      dateFrom: "2026-01-01",
      dateTo: "2026-04-30",
      granularity: "day",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toContain("92");
    }
    expect(calls.period).toHaveLength(0);
  });

  it("menolak rentang mingguan lebih dari 182 hari", async () => {
    const { period } = setup();
    const result = await period.execute({
      dateFrom: "2026-01-01",
      dateTo: "2026-07-02",
      granularity: "week",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toContain("182");
    }
  });

  it("menerima rentang bulanan hingga 730 hari", async () => {
    const { period } = setup();
    const result = await period.execute({
      dateFrom: "2025-01-01",
      dateTo: "2026-12-31",
      granularity: "month",
    });
    expect(result.success).toBe(true);
  });

  it("menolak granularitas yang tidak dikenal", async () => {
    const { period } = setup();
    const result = await period.execute({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-06",
      granularity: "year" as never,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("meneruskan error repository periode", async () => {
    const error = new ValidationError("database error", {});
    const { period } = setup({ periodError: error });
    const result = await period.execute({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-06",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(error);
    }
  });
});

describe("previousRange", () => {
  it("menghitung rentang berdurasi sama tepat sebelumnya", () => {
    expect(previousRange("2026-10-01", "2026-10-30")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("melewati batas tahun", () => {
    expect(previousRange("2026-01-01", "2026-01-31")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});

describe("entity advanced-report", () => {
  it("menjumlahkan baris periode", () => {
    const totals = sumPeriodRows([
      periodRow("2026-10-01", 100),
      periodRow("2026-10-02", 250),
    ]);
    expect(totals).toEqual({
      netSales: 2000,
      cogs: 800,
      expenseTotal: 200,
      netProfit: 350,
    });
  });

  it("menghitung persen perubahan dengan pembulatan 1 desimal", () => {
    expect(deltaPercent(110, 100)).toBe(10);
    expect(deltaPercent(90, 100)).toBe(-10);
    expect(deltaPercent(1005, 1000)).toBe(0.5);
    expect(deltaPercent(5, 0)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  CreateExpenseCategoryUseCase,
  DeleteExpenseCategoryUseCase,
  DeleteExpenseUseCase,
  ListExpensesUseCase,
  RecordExpenseUseCase,
  UpdateExpenseCategoryUseCase,
  UpdateExpenseUseCase,
} from "@/modules/finance/application/use-cases/expense.use-cases";
import {
  GetCashFlowUseCase,
  GetProfitLossUseCase,
  GetProfitTrendUseCase,
} from "@/modules/finance/application/use-cases/finance-report.use-cases";
import {
  Expense,
  ExpenseCategory,
} from "@/modules/finance/domain/entities/expense";
import { FinancePolicy } from "@/modules/finance/domain/services/finance-policy";
import type {
  CreateExpenseRecord,
  ExpenseFilter,
  ExpenseListResult,
  IExpenseCategoryRepository,
  IExpenseRepository,
  UpdateExpenseRecord,
} from "@/modules/finance/domain/repositories/expense.repository";
import type { IFinanceReportRepository } from "@/modules/finance/domain/repositories/finance-report.repository";
import type { CashFlowRow } from "@/modules/finance/domain/services/finance-policy";
import { Money } from "@/shared/lib/money";
import { NotFoundError, ValidationError } from "@/shared/kernel/errors";
import { ok, type Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

const EXPENSE_ID = "10000000-0000-4000-8000-000000000001";
const CATEGORY_ID = "10000000-0000-4000-8000-000000000002";
const USER_ID = "10000000-0000-4000-8000-000000000003";

function makeCategory(name = "Operasional", id = CATEGORY_ID): ExpenseCategory {
  return ExpenseCategory.create({ name }, id);
}

function makeExpense(id = EXPENSE_ID): Expense {
  return Expense.create(
    {
      categoryId: CATEGORY_ID,
      amount: Money.create(150000),
      note: "Bayar listrik",
      expenseDate: "2026-10-05",
      createdBy: USER_ID,
    },
    id
  );
}

interface ExpenseSpy {
  repository: IExpenseRepository;
  created: CreateExpenseRecord[];
  updated: Array<{ id: string; patch: UpdateExpenseRecord }>;
  deletedIds: string[];
  lastFilter: ExpenseFilter | null;
  listResult: ExpenseListResult;
}

function expenseRepo(existing: Expense | null = makeExpense()): ExpenseSpy {
  const created: CreateExpenseRecord[] = [];
  const updated: Array<{ id: string; patch: UpdateExpenseRecord }> = [];
  const deletedIds: string[] = [];
  let lastFilter: ExpenseFilter | null = null;
  const listResult: ExpenseListResult = {
    items: existing ? [existing] : [],
    total: existing ? 1 : 0,
    page: 1,
    pageSize: 20,
  };
  const repository: IExpenseRepository = {
    findAll: async (filter) => {
      lastFilter = filter;
      return ok(listResult);
    },
    findById: async () => ok(existing),
    create: async (record) => {
      created.push(record);
      return ok(
        Expense.create(
          {
            categoryId: record.categoryId,
            amount: Money.create(record.amount),
            note: record.note ?? "",
            expenseDate: record.expenseDate ?? "2026-10-06",
            createdBy: record.createdBy,
          },
          EXPENSE_ID
        )
      );
    },
    update: async (id, patch) => {
      updated.push({ id, patch });
      return ok(makeExpense(id));
    },
    delete: async (id) => {
      deletedIds.push(id);
      return ok(undefined);
    },
  };
  return {
    repository,
    created,
    updated,
    deletedIds,
    get lastFilter() {
      return lastFilter;
    },
    listResult,
  };
}

interface CategorySpy {
  repository: IExpenseCategoryRepository;
  createdNames: string[];
  updated: Array<{ id: string; name: string }>;
  deletedIds: string[];
}

function categoryRepo(
  existing: ExpenseCategory | null = makeCategory()
): CategorySpy {
  const createdNames: string[] = [];
  const updated: Array<{ id: string; name: string }> = [];
  const deletedIds: string[] = [];
  const repository: IExpenseCategoryRepository = {
    findAll: async () => ok(existing ? [existing] : []),
    findById: async () => ok(existing),
    create: async (name) => {
      createdNames.push(name);
      return ok(makeCategory(name));
    },
    update: async (id, name) => {
      updated.push({ id, name });
      return ok(makeCategory(name, id));
    },
    delete: async (id) => {
      deletedIds.push(id);
      return ok(undefined);
    },
  };
  return { repository, createdNames, updated, deletedIds };
}

interface ReportSpy {
  repository: IFinanceReportRepository;
  cashFlowArgs: string[] | null;
  profitLossArgs: string[] | null;
  monthlyArgs: string[] | null;
}

function reportRepo(options?: {
  cashFlowRows?: CashFlowRow[];
  profitLoss?: {
    grossSales: number;
    discountTotal: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    expenseTotal: number;
    netProfit: number;
  };
  expenseSummary?: {
    categoryId: string;
    categoryName: string;
    entries: number;
    total: number;
  }[];
  monthly?: {
    monthStart: string;
    netSales: number;
    cogs: number;
    expenseTotal: number;
    netProfit: number;
  }[];
}): ReportSpy {
  let cashFlowArgs: string[] | null = null;
  let profitLossArgs: string[] | null = null;
  let monthlyArgs: string[] | null = null;
  const repository: IFinanceReportRepository = {
    getCashFlow: async (from, to) => {
      cashFlowArgs = [from, to];
      return ok(options?.cashFlowRows ?? []);
    },
    getProfitLoss: async (from, to) => {
      profitLossArgs = [from, to];
      return ok(
        options?.profitLoss ?? {
          grossSales: 0,
          discountTotal: 0,
          netSales: 0,
          cogs: 0,
          grossProfit: 0,
          expenseTotal: 0,
          netProfit: 0,
        }
      );
    },
    getExpenseSummary: async () => ok(options?.expenseSummary ?? []),
    getMonthlyProfit: async (from, to) => {
      monthlyArgs = [from, to];
      return ok(options?.monthly ?? []);
    },
  };
  return {
    repository,
    get cashFlowArgs() {
      return cashFlowArgs;
    },
    get profitLossArgs() {
      return profitLossArgs;
    },
    get monthlyArgs() {
      return monthlyArgs;
    },
  };
}

function isErrResult<T>(
  result: Result<T, DomainError>
): result is { success: false; error: DomainError } {
  return !result.success;
}

describe("FinancePolicy", () => {
  it("menvalidasi urutan periode", () => {
    expect(FinancePolicy.isChronological("2026-10-01", "2026-10-31")).toBe(
      true
    );
    expect(FinancePolicy.isChronological("2026-10-31", "2026-10-01")).toBe(
      false
    );
  });

  it("menghitung margin laba bersih", () => {
    expect(FinancePolicy.marginPercent(500, 1000)).toBe(50);
    expect(FinancePolicy.marginPercent(500, 0)).toBe(0);
    expect(FinancePolicy.marginPercent(-200, 1000)).toBe(-20);
  });

  it("merangkum arus kas per arah beserta saldo", () => {
    const rows: CashFlowRow[] = [
      {
        direction: "in",
        source: "sale_cash",
        label: "Penjualan tunai",
        entries: 5,
        amount: 100000,
      },
      {
        direction: "in",
        source: "shift_in",
        label: "Kas masuk shift",
        entries: 1,
        amount: 50000,
      },
      {
        direction: "out",
        source: "expense",
        label: "Pengeluaran",
        entries: 2,
        amount: 30000,
      },
    ];
    const summary = FinancePolicy.summarizeCashFlow(rows);
    expect(summary.inflow).toBe(150000);
    expect(summary.outflow).toBe(30000);
    expect(summary.balance).toBe(120000);
    expect(summary.inflows.map((r) => r.source)).toEqual([
      "sale_cash",
      "shift_in",
    ]);
    expect(summary.outflows).toHaveLength(1);
  });

  it("merangkum arus kas kosong menjadi saldo nol", () => {
    const summary = FinancePolicy.summarizeCashFlow([]);
    expect(summary).toEqual({
      inflow: 0,
      outflow: 0,
      balance: 0,
      inflows: [],
      outflows: [],
    });
  });

  it("menyusun jendela 12 bulan terakhir hingga tanggal tuju", () => {
    expect(FinancePolicy.monthWindow("2026-10-06", 12)).toEqual({
      from: "2025-11-01",
      to: "2026-10-06",
    });
    expect(FinancePolicy.monthWindow("2026-10-06", 1)).toEqual({
      from: "2026-10-01",
      to: "2026-10-06",
    });
  });

  it("membatasi tanggal jendela pada panjang bulan", () => {
    expect(FinancePolicy.monthWindow("2026-04-31", 1)).toEqual({
      from: "2026-04-01",
      to: "2026-04-30",
    });
  });
});

describe("Entity expense", () => {
  it("mentrims nama kategori dan catatan", () => {
    const category = ExpenseCategory.create(
      { name: "  Listrik  " },
      CATEGORY_ID
    );
    expect(category.name).toBe("Listrik");
    const expense = Expense.create(
      {
        categoryId: CATEGORY_ID,
        amount: Money.create(1000),
        note: "  bayar  ",
        expenseDate: "2026-10-06",
        createdBy: null,
      },
      EXPENSE_ID
    );
    expect(expense.note).toBe("bayar");
    expect(expense.amount.amount).toBe(1000);
  });
});

describe("CreateExpenseCategoryUseCase", () => {
  it("membuat kategori dengan nama trim", async () => {
    const spy = categoryRepo();
    const useCase = new CreateExpenseCategoryUseCase(spy.repository);
    const result = await useCase.execute({ name: "  Operasional  " });
    expect(result.success).toBe(true);
    expect(spy.createdNames).toEqual(["Operasional"]);
  });

  it("menolak nama terlalu pendek", async () => {
    const spy = categoryRepo();
    const useCase = new CreateExpenseCategoryUseCase(spy.repository);
    const result = await useCase.execute({ name: "x" });
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(
        (result.error as ValidationError).validationErrors?.name
      ).toBeDefined();
    }
    expect(spy.createdNames).toHaveLength(0);
  });
});

describe("UpdateExpenseCategoryUseCase", () => {
  it("mengembalikan NotFound untuk kategori hilang", async () => {
    const spy = categoryRepo(null);
    const useCase = new UpdateExpenseCategoryUseCase(spy.repository);
    const result = await useCase.execute(CATEGORY_ID, { name: "Baru" });
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
    expect(spy.updated).toHaveLength(0);
  });

  it("memperbarui nama kategori", async () => {
    const spy = categoryRepo();
    const useCase = new UpdateExpenseCategoryUseCase(spy.repository);
    const result = await useCase.execute(CATEGORY_ID, { name: "  Gas  " });
    expect(result.success).toBe(true);
    expect(spy.updated).toEqual([{ id: CATEGORY_ID, name: "Gas" }]);
  });
});

describe("DeleteExpenseCategoryUseCase", () => {
  it("menolak hapus kategori yang tidak ada", async () => {
    const spy = categoryRepo(null);
    const useCase = new DeleteExpenseCategoryUseCase(spy.repository);
    const result = await useCase.execute(CATEGORY_ID);
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it("menghapus kategori yang ada", async () => {
    const spy = categoryRepo();
    const useCase = new DeleteExpenseCategoryUseCase(spy.repository);
    const result = await useCase.execute(CATEGORY_ID);
    expect(result.success).toBe(true);
    expect(spy.deletedIds).toEqual([CATEGORY_ID]);
  });
});

describe("RecordExpenseUseCase", () => {
  it("mencatat pengeluaran dengan pembuat transaksi", async () => {
    const expenseSpy = expenseRepo();
    const categorySpy = categoryRepo();
    const useCase = new RecordExpenseUseCase(
      expenseSpy.repository,
      categorySpy.repository
    );
    const result = await useCase.execute(USER_ID, {
      categoryId: CATEGORY_ID,
      amount: 150000.4,
      note: "Bayar listrik",
      expenseDate: "2026-10-05",
    });
    expect(result.success).toBe(true);
    expect(expenseSpy.created).toEqual([
      {
        categoryId: CATEGORY_ID,
        amount: 150000,
        note: "Bayar listrik",
        expenseDate: "2026-10-05",
        createdBy: USER_ID,
      },
    ]);
  });

  it("menolak nominal nol atau negatif", async () => {
    const expenseSpy = expenseRepo();
    const categorySpy = categoryRepo();
    const useCase = new RecordExpenseUseCase(
      expenseSpy.repository,
      categorySpy.repository
    );
    const result = await useCase.execute(USER_ID, {
      categoryId: CATEGORY_ID,
      amount: 0,
      expenseDate: "2026-10-05",
    });
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(
        (result.error as ValidationError).validationErrors?.amount
      ).toBeDefined();
    }
    expect(expenseSpy.created).toHaveLength(0);
  });

  it("menolak tanggal bukan YYYY-MM-DD", async () => {
    const expenseSpy = expenseRepo();
    const categorySpy = categoryRepo();
    const useCase = new RecordExpenseUseCase(
      expenseSpy.repository,
      categorySpy.repository
    );
    const result = await useCase.execute(USER_ID, {
      categoryId: CATEGORY_ID,
      amount: 1000,
      expenseDate: "05/10/2026",
    });
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(
        (result.error as ValidationError).validationErrors?.expenseDate
      ).toBeDefined();
    }
  });

  it("menolak kategori yang tidak ditemukan", async () => {
    const expenseSpy = expenseRepo();
    const categorySpy = categoryRepo(null);
    const useCase = new RecordExpenseUseCase(
      expenseSpy.repository,
      categorySpy.repository
    );
    const result = await useCase.execute(USER_ID, {
      categoryId: CATEGORY_ID,
      amount: 1000,
      expenseDate: "2026-10-05",
    });
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
    expect(expenseSpy.created).toHaveLength(0);
  });
});

describe("ListExpensesUseCase", () => {
  it("meneruskan filter tervalidasi ke repository", async () => {
    const spy = expenseRepo();
    const useCase = new ListExpensesUseCase(spy.repository);
    const result = await useCase.list({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
      categoryId: CATEGORY_ID,
      page: 2,
      pageSize: 10,
    });
    expect(result.success).toBe(true);
    expect(spy.lastFilter).toEqual({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
      categoryId: CATEGORY_ID,
      page: 2,
      pageSize: 10,
    });
  });

  it("menolak periode terbalik", async () => {
    const spy = expenseRepo();
    const useCase = new ListExpensesUseCase(spy.repository);
    const result = await useCase.list({
      dateFrom: "2026-10-31",
      dateTo: "2026-10-01",
    });
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(spy.lastFilter).toBeNull();
    }
  });

  it("menolak format tanggal yang salah", async () => {
    const spy = expenseRepo();
    const useCase = new ListExpensesUseCase(spy.repository);
    const result = await useCase.list({ dateFrom: "Oktober" });
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(
        (result.error as ValidationError).validationErrors?.dateFrom
      ).toBeDefined();
    }
  });
});

describe("UpdateExpenseUseCase & DeleteExpenseUseCase", () => {
  it("menolak update pengeluaran yang tidak ada", async () => {
    const spy = expenseRepo(null);
    const useCase = new UpdateExpenseUseCase(spy.repository);
    const result = await useCase.execute(EXPENSE_ID, { amount: 200000 });
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it("memperbarui nominal dengan pembulatan", async () => {
    const spy = expenseRepo();
    const useCase = new UpdateExpenseUseCase(spy.repository);
    const result = await useCase.execute(EXPENSE_ID, { amount: 200000.7 });
    expect(result.success).toBe(true);
    expect(spy.updated).toEqual([
      { id: EXPENSE_ID, patch: { amount: 200001 } },
    ]);
  });

  it("menghapus pengeluaran yang ada", async () => {
    const spy = expenseRepo();
    const useCase = new DeleteExpenseUseCase(spy.repository);
    const result = await useCase.execute(EXPENSE_ID);
    expect(result.success).toBe(true);
    expect(spy.deletedIds).toEqual([EXPENSE_ID]);
  });
});

describe("GetCashFlowUseCase", () => {
  it("menolak periode terbalik", async () => {
    const spy = reportRepo();
    const useCase = new GetCashFlowUseCase(spy.repository);
    const result = await useCase.execute({
      dateFrom: "2026-10-31",
      dateTo: "2026-10-01",
    });
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
    expect(spy.cashFlowArgs).toBeNull();
  });

  it("merangkum kas masuk, keluar, dan saldo periode", async () => {
    const spy = reportRepo({
      cashFlowRows: [
        {
          direction: "in",
          source: "sale_cash",
          label: "Penjualan tunai",
          entries: 3,
          amount: 500000,
        },
        {
          direction: "out",
          source: "expense",
          label: "Pengeluaran",
          entries: 1,
          amount: 120000,
        },
      ],
    });
    const useCase = new GetCashFlowUseCase(spy.repository);
    const result = await useCase.execute({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.from).toBe("2026-10-01");
      expect(result.data.to).toBe("2026-10-31");
      expect(result.data.summary.inflow).toBe(500000);
      expect(result.data.summary.outflow).toBe(120000);
      expect(result.data.summary.balance).toBe(380000);
    }
    expect(spy.cashFlowArgs).toEqual(["2026-10-01", "2026-10-31"]);
  });
});

describe("GetProfitLossUseCase", () => {
  it("memetakan ringkasan laba rugi dari database (dibulatkan)", async () => {
    const spy = reportRepo({
      profitLoss: {
        grossSales: 1000000,
        discountTotal: 100000,
        netSales: 900000.4,
        cogs: 400000.6,
        grossProfit: 499999,
        expenseTotal: 150000,
        netProfit: 349999,
      },
      expenseSummary: [
        {
          categoryId: CATEGORY_ID,
          categoryName: "Operasional",
          entries: 2,
          total: 150000,
        },
      ],
    });
    const useCase = new GetProfitLossUseCase(spy.repository);
    const result = await useCase.execute({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary.netSales).toBe(900000);
      expect(result.data.summary.cogs).toBe(400001);
      expect(result.data.summary.grossProfit).toBe(499999);
      expect(result.data.summary.expenseTotal).toBe(150000);
      expect(result.data.summary.netProfit).toBe(349999);
      expect(result.data.expensesByCategory).toEqual([
        {
          categoryId: CATEGORY_ID,
          categoryName: "Operasional",
          entries: 2,
          total: 150000,
        },
      ]);
    }
  });

  it("menolak format periode yang salah", async () => {
    const spy = reportRepo();
    const useCase = new GetProfitLossUseCase(spy.repository);
    const result = await useCase.execute({
      dateFrom: "2026/10/01",
      dateTo: "2026-10-31",
    });
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
    expect(spy.profitLossArgs).toBeNull();
  });
});

describe("GetProfitTrendUseCase", () => {
  it("meminta data bulanan untuk jendela 12 bulan terakhir", async () => {
    const spy = reportRepo({
      monthly: [
        {
          monthStart: "2025-11-01",
          netSales: 1000000.4,
          cogs: 400000,
          expenseTotal: 100000,
          netProfit: 499999.6,
        },
      ],
    });
    const useCase = new GetProfitTrendUseCase(spy.repository);
    const result = await useCase.execute("2026-10-06");
    expect(result.success).toBe(true);
    expect(spy.monthlyArgs).toEqual(["2025-11-01", "2026-10-06"]);
    if (result.success) {
      expect(result.data.months).toEqual([
        {
          monthStart: "2025-11-01",
          netSales: 1000000,
          cogs: 400000,
          expenseTotal: 100000,
          netProfit: 500000,
        },
      ]);
    }
  });

  it("menolak tanggal tuju yang tidak valid", async () => {
    const spy = reportRepo();
    const useCase = new GetProfitTrendUseCase(spy.repository);
    const result = await useCase.execute("6 Oktober");
    expect(isErrResult(result)).toBe(true);
    if (isErrResult(result)) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
    expect(spy.monthlyArgs).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  ListSupplierDebtsUseCase,
  RecordSupplierPaymentUseCase,
} from "@/modules/purchasing/application/use-cases/supplier-debt.use-cases";
import type { ISupplierDebtRepository } from "@/modules/purchasing/domain/repositories/supplier-debt.repository";
import { SupplierDebt } from "@/modules/purchasing/domain/entities/supplier-debt";
import { Money } from "@/shared/lib/money";
import { ValidationError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";

function makeDebt(remaining: number, paid: number): SupplierDebt {
  return SupplierDebt.create(
    {
      poId: "po-1",
      poNo: "PO-1",
      supplierId: "sup-1",
      supplierName: "PT Maju",
      orderDate: "2026-08-01",
      total: Money.create(100000),
      paid: Money.create(paid),
      remaining: Money.create(remaining),
      dueDate: "2026-08-15",
    },
    "po-1"
  );
}

describe("RecordSupplierPaymentUseCase", () => {
  function setup(debt: SupplierDebt | null) {
    const repo: ISupplierDebtRepository = {
      listDebts: async () =>
        ok({
          items: debt ? [debt] : [],
          total: debt ? 1 : 0,
          page: 1,
          pageSize: 20,
        }),
      getPayments: async () => ok([]),
      recordPayment: async () => {
        throw new Error("not used");
      },
    };
    return new RecordSupplierPaymentUseCase(repo);
  }

  it("menolak bayar melebihi sisa", async () => {
    const result = await setup(makeDebt(30000, 70000)).execute("po-1", {
      amount: 50000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("menolak nominal 0", async () => {
    const result = await setup(makeDebt(30000, 70000)).execute("po-1", {
      amount: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("ListSupplierDebtsUseCase", () => {
  it("meneruskan filter", async () => {
    const repo: ISupplierDebtRepository = {
      listDebts: async () =>
        ok({ items: [makeDebt(0, 100000)], total: 1, page: 1, pageSize: 20 }),
      getPayments: async () => ok([]),
      recordPayment: async () => {
        throw new Error("not used");
      },
    };
    const result = await new ListSupplierDebtsUseCase(repo).execute({
      status: "paid",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0]?.isPaid).toBe(true);
    }
  });
});

describe("SupplierDebt entity", () => {
  it("overdue bila lewat jatuh tempo dan belum lunas", () => {
    expect(makeDebt(1000, 99000).isOverdue).toBe(true);
    expect(makeDebt(0, 100000).isOverdue).toBe(false);
  });
});

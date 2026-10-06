import { describe, expect, it } from "vitest";
import { RecordReceivablePaymentUseCase } from "@/modules/customers/application/use-cases/receivable.use-cases";
import type { IReceivableRepository } from "@/modules/customers/application/use-cases/receivable.use-cases";
import type { ICustomerRepository } from "@/modules/customers/domain/repositories/customer.repository";
import { Customer } from "@/modules/customers/domain/entities/customer";
import { NotFoundError, ValidationError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";

function setup(balance: number, exists = true) {
  const customers: ICustomerRepository = {
    findById: async (id) =>
      ok(
        exists
          ? Customer.create(
              {
                name: "Budi",
                phone: "",
                email: "",
                address: "",
                points: 0,
                receivableBalance: balance,
              },
              id
            )
          : null
      ),
    search: async () => ok({ items: [], total: 0, page: 1, pageSize: 20 }),
    create: async () => {
      throw new Error("not used");
    },
    update: async () => {
      throw new Error("not used");
    },
    softDelete: async () => ok(undefined),
    getHistory: async () =>
      ok({
        purchases: [],
        totalSpent: 0,
        transactionCount: 0,
        averagePerTransaction: 0,
      }),
  };
  const receivables: IReceivableRepository = {
    listReceivables: async () => ok([]),
    recordPayment: async () => ok({ newBalance: balance - 1000 }),
    getPaymentHistory: async () => ok([]),
  };
  return new RecordReceivablePaymentUseCase(receivables, customers);
}

describe("RecordReceivablePaymentUseCase", () => {
  it("menolak melebihi saldo", async () => {
    const result = await setup(5000).execute("c-1", { amount: 6000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("mencatat pembayaran valid", async () => {
    const result = await setup(5000).execute("c-1", { amount: 1000 });
    expect(result.success).toBe(true);
  });

  it("menolak pelanggan tak ada", async () => {
    const result = await setup(0, false).execute("c-x", { amount: 100 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});

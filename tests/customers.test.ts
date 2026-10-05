import { describe, expect, it } from "vitest";
import {
  CreateCustomerUseCase,
  DeleteCustomerUseCase,
  GetCustomerHistoryUseCase,
  SearchCustomersUseCase,
  UpdateCustomerUseCase,
} from "@/modules/customers/application/use-cases/customer.use-cases";
import type { ICustomerRepository } from "@/modules/customers/domain/repositories/customer.repository";
import { Customer } from "@/modules/customers/domain/entities/customer";
import { NotFoundError, ValidationError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";

function makeCustomer(id: string, name: string): Customer {
  return Customer.create(
    {
      name,
      phone: "081",
      email: "",
      address: "",
      points: 0,
      receivableBalance: 0,
    },
    id
  );
}

function setup(store: { customers: Customer[] }) {
  const repo: ICustomerRepository = {
    findById: async (id) =>
      ok(store.customers.find((c) => c.id === id) ?? null),
    search: async (filter) => {
      const q = (filter.query ?? "").toLowerCase();
      const items = store.customers.filter(
        (c) => !q || c.name.toLowerCase().includes(q)
      );
      return ok({ items, total: items.length, page: 1, pageSize: 20 });
    },
    create: async (record) => {
      const created = Customer.create(
        {
          name: record.name,
          phone: record.phone ?? "",
          email: record.email ?? "",
          address: record.address ?? "",
          points: 0,
          receivableBalance: 0,
        },
        `c-${store.customers.length + 1}`
      );
      store.customers.push(created);
      return ok(created);
    },
    update: async (id, patch) => {
      const existing = store.customers.find((c) => c.id === id);
      if (!existing) {
        throw new Error("not found in fake");
      }
      const updated = Customer.create(
        {
          name: patch.name ?? existing.name,
          phone: patch.phone ?? existing.phone,
          email: patch.email ?? existing.email,
          address: patch.address ?? existing.address,
          points: 0,
          receivableBalance: 0,
        },
        existing.id
      );
      store.customers = store.customers.map((c) => (c.id === id ? updated : c));
      return ok(updated);
    },
    softDelete: async (id) => {
      store.customers = store.customers.filter((c) => c.id !== id);
      return ok(undefined);
    },
    getHistory: async () =>
      ok({
        purchases: [],
        totalSpent: 0,
        transactionCount: 0,
        averagePerTransaction: 0,
      }),
  };
  return {
    createUseCase: new CreateCustomerUseCase(repo),
    updateUseCase: new UpdateCustomerUseCase(repo),
    deleteUseCase: new DeleteCustomerUseCase(repo),
    searchUseCase: new SearchCustomersUseCase(repo),
    historyUseCase: new GetCustomerHistoryUseCase(repo),
  };
}

describe("CreateCustomerUseCase", () => {
  it("membuat pelanggan dengan nama", async () => {
    const { createUseCase } = setup({ customers: [] });
    const result = await createUseCase.execute({ name: "Budi" });
    expect(result.success).toBe(true);
  });

  it("menolak nama kosong dan email salah", async () => {
    const { createUseCase } = setup({ customers: [] });
    const empty = await createUseCase.execute({ name: "" });
    expect(empty.success).toBe(false);
    const badEmail = await createUseCase.execute({
      name: "Budi",
      email: "bukan-email",
    });
    expect(badEmail.success).toBe(false);
    if (!badEmail.success) {
      expect(badEmail.error).toBeInstanceOf(ValidationError);
    }
  });
});

describe("UpdateCustomerUseCase", () => {
  it("menolak id tidak ada", async () => {
    const { updateUseCase } = setup({ customers: [] });
    const result = await updateUseCase.execute("c-x", { name: "Baru" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});

describe("DeleteCustomerUseCase", () => {
  it("menghapus pelanggan ada", async () => {
    const { deleteUseCase } = setup({
      customers: [makeCustomer("c-1", "Ani")],
    });
    const result = await deleteUseCase.execute("c-1");
    expect(result.success).toBe(true);
  });
});

describe("SearchCustomersUseCase", () => {
  it("mencari per nama", async () => {
    const { searchUseCase } = setup({
      customers: [
        makeCustomer("c-1", "Budi Santoso"),
        makeCustomer("c-2", "Ani"),
      ],
    });
    const result = await searchUseCase.execute("budi");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("Budi Santoso");
    }
  });
});

describe("GetCustomerHistoryUseCase", () => {
  it("menolak id tidak ada", async () => {
    const { historyUseCase } = setup({ customers: [] });
    const result = await historyUseCase.execute("c-x");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});

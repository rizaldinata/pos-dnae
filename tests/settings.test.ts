import { describe, expect, it } from "vitest";
import {
  GetStoreSettingsUseCase,
  UpdateStoreSettingsUseCase,
} from "@/modules/settings/application/use-cases/store-settings.use-cases";
import {
  CreatePaymentMethodUseCase,
  UpdatePaymentMethodUseCase,
} from "@/modules/settings/application/use-cases/payment-method.use-cases";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import type { IPaymentMethodRepository } from "@/modules/settings/domain/repositories/payment-method.repository";
import { PaymentMethod } from "@/modules/settings/domain/entities/payment-method";
import { DEFAULT_STORE_SETTINGS } from "@/modules/settings/domain/entities/store-setting";
import { NotFoundError, ValidationError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";

function setupSettings(store: Record<string, unknown>) {
  const repo: ISettingsRepository = {
    getAll: async () => ok({ ...store }),
    get: async (key) => ok(store[key] ?? null),
    set: async (key, value) => {
      store[key] = value;
      return ok(undefined);
    },
    setMany: async (entries) => {
      Object.assign(store, entries);
      return ok(undefined);
    },
  };
  return {
    getUseCase: new GetStoreSettingsUseCase(repo),
    updateUseCase: new UpdateStoreSettingsUseCase(repo),
  };
}

describe("Store settings", () => {
  it("fallback ke default bila kosong", async () => {
    const { getUseCase } = setupSettings({});
    const result = await getUseCase.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(DEFAULT_STORE_SETTINGS);
    }
  });

  it("update menyimpan allowlist keys", async () => {
    const store: Record<string, unknown> = {};
    const { updateUseCase } = setupSettings(store);
    const result = await updateUseCase.execute({
      storeName: "Toko Baru",
      storeAddress: "Jl. Baru",
      storePhone: "0800",
      storeLogoUrl: "",
      receiptFooter: "Makasih",
    });
    expect(result.success).toBe(true);
    expect(store["store.name"]).toBe("Toko Baru");
    expect(store["tax.rate"]).toBeUndefined();
  });

  it("menolak nama kosong", async () => {
    const { updateUseCase } = setupSettings({});
    const result = await updateUseCase.execute({ storeName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });
});

function setupPayments() {
  const tunai = PaymentMethod.create(
    { name: "Tunai", type: "cash", isActive: true },
    "pm-tunai"
  );
  const qris = PaymentMethod.create(
    { name: "QRIS", type: "qris", isActive: true },
    "pm-qris"
  );
  const store = [tunai, qris];
  const repo: IPaymentMethodRepository = {
    findAll: async () => ok([...store]),
    findActive: async () => ok(store.filter((m) => m.isActive)),
    findById: async (id) => ok(store.find((m) => m.id === id) ?? null),
    create: async (record) => {
      const created = PaymentMethod.create(
        { name: record.name, type: record.type, isActive: true },
        `pm-${store.length + 1}`
      );
      store.push(created);
      return ok(created);
    },
    update: async (id, patch) => {
      const existing = store.find((m) => m.id === id);
      if (!existing) {
        throw new Error("not found in fake");
      }
      const updated = PaymentMethod.create(
        {
          name: patch.name ?? existing.name,
          type: patch.type ?? existing.type,
          isActive: patch.isActive ?? existing.isActive,
        },
        existing.id
      );
      store.splice(store.indexOf(existing), 1, updated);
      return ok(updated);
    },
  };
  return {
    createUseCase: new CreatePaymentMethodUseCase(repo),
    updateUseCase: new UpdatePaymentMethodUseCase(repo),
  };
}

describe("Payment methods", () => {
  it("membuat metode baru", async () => {
    const { createUseCase } = setupPayments();
    const result = await createUseCase.execute({
      name: "Transfer BCA",
      type: "transfer",
    });
    expect(result.success).toBe(true);
  });

  it("menolak tipe tidak valid", async () => {
    const { createUseCase } = setupPayments();
    const result = await createUseCase.execute({
      name: "X",
      type: "emas" as never,
    });
    expect(result.success).toBe(false);
  });

  it("menolak nonaktifkan satu-satunya tunai aktif", async () => {
    const { updateUseCase } = setupPayments();
    const result = await updateUseCase.execute("pm-tunai", { isActive: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("boleh nonaktifkan tunai bila ada tunai aktif lain", async () => {
    const { createUseCase, updateUseCase } = setupPayments();
    const created = await createUseCase.execute({
      name: "Tunai 2",
      type: "cash",
    });
    expect(created.success).toBe(true);
    const result = await updateUseCase.execute("pm-tunai", { isActive: false });
    expect(result.success).toBe(true);
  });

  it("menolak id yang tidak ada", async () => {
    const { updateUseCase } = setupPayments();
    const result = await updateUseCase.execute("pm-tidak-ada", { name: "X" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});

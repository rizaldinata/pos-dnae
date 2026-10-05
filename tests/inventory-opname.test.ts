import { describe, expect, it } from "vitest";
import {
  AdjustStockUseCase,
  ApproveOpnameUseCase,
  CreateOpnameUseCase,
  UpdateOpnameItemUseCase,
} from "@/modules/inventory/application/use-cases/opname.use-cases";
import type { IStockOpnameRepository } from "@/modules/inventory/domain/repositories/stock-opname.repository";
import type { IStockRepository } from "@/modules/inventory/domain/repositories/stock.repository";
import { StockOpname } from "@/modules/inventory/domain/entities/stock-opname";
import { Stock } from "@/modules/inventory/domain/entities/stock";
import { NotFoundError, ValidationError } from "@/shared/kernel/errors";
import { err, ok } from "@/shared/kernel/result";
import { InvariantViolationError } from "@/shared/kernel/errors";

function makeDetail(status: "draft" | "approved" = "draft") {
  return {
    opname: StockOpname.create(
      { code: "OPN-1", status, createdBy: "u-1", approvedBy: null },
      "op-1"
    ),
    items: [
      {
        id: "oi-1",
        opnameId: "op-1",
        variantId: "v-1",
        systemQty: 100,
        actualQty: 100,
        diff: 0,
        productName: "Beras",
        variantName: "",
        sku: "BRS",
      },
    ],
    totalDiff: 0,
  };
}

function setupOpnames(detail: ReturnType<typeof makeDetail> | null) {
  const repo: IStockOpnameRepository = {
    createOpname: async () => ok(makeDetail()),
    findById: async () => ok(detail),
    listOpnames: async () => ok([]),
    updateItem: async () => ok(makeDetail()),
    approveOpname: async () => ok({ adjustedItems: 1 }),
  };
  return {
    createUseCase: new CreateOpnameUseCase(repo),
    updateUseCase: new UpdateOpnameItemUseCase(repo),
    approveUseCase: new ApproveOpnameUseCase(repo),
  };
}

function setupStocks() {
  const repo: IStockRepository = {
    getByVariantId: async () =>
      ok(Stock.create({ variantId: "v-1", qty: 100 })),
    listOverview: async () =>
      ok({ items: [], total: 0, page: 1, pageSize: 20 }),
    getOverviewByVariantId: async () => ok(null),
    adjustStock: async (record) =>
      ok({ variantId: record.variantId, oldQty: 100, newQty: record.newQty }),
    countLowStock: async () => ok(0),
  };
  return new AdjustStockUseCase(repo);
}

describe("AdjustStockUseCase", () => {
  it("menyesuaikan dengan alasan valid", async () => {
    const result = await setupStocks().execute("v-1", {
      newQty: 90,
      reason: "rusak",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newQty).toBe(90);
    }
  });

  it("menolak tanpa alasan", async () => {
    const result = await setupStocks().execute("v-1", {
      newQty: 90,
      reason: "  ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("meneruskan error repository", async () => {
    const repo: IStockRepository = {
      getByVariantId: async () => err(new InvariantViolationError("db down")),
      listOverview: async () =>
        ok({ items: [], total: 0, page: 1, pageSize: 20 }),
      getOverviewByVariantId: async () => ok(null),
      adjustStock: async () => {
        throw new Error("unreachable");
      },
      countLowStock: async () => ok(0),
    };
    const result = await new AdjustStockUseCase(repo).execute("v-1", {
      newQty: 1,
      reason: "x",
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateOpnameItemUseCase", () => {
  it("menolak ubah sesi yang sudah approved", async () => {
    const { updateUseCase } = setupOpnames(makeDetail("approved"));
    const result = await updateUseCase.execute("op-1", "v-1", { actualQty: 5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("menolak sesi tidak ada", async () => {
    const { updateUseCase } = setupOpnames(null);
    const result = await updateUseCase.execute("op-x", "v-1", { actualQty: 5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});

describe("ApproveOpnameUseCase", () => {
  it("approve sesi draft", async () => {
    const { approveUseCase } = setupOpnames(makeDetail("draft"));
    const result = await approveUseCase.execute("op-1");
    expect(result.success).toBe(true);
  });

  it("menolak approve ulang", async () => {
    const { approveUseCase } = setupOpnames(makeDetail("approved"));
    const result = await approveUseCase.execute("op-1");
    expect(result.success).toBe(false);
  });
});

describe("CreateOpnameUseCase", () => {
  it("membuat sesi baru", async () => {
    const { createUseCase } = setupOpnames(makeDetail());
    const result = await createUseCase.execute(null);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.opname.code).toBe("OPN-1");
    }
  });
});

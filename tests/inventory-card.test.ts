import { describe, expect, it } from "vitest";
import { GetStockCardUseCase } from "@/modules/inventory/application/use-cases/stock.use-cases";
import type {
  IStockMovementRepository,
  IStockRepository,
} from "@/modules/inventory/domain/repositories/stock.repository";
import {
  Stock,
  StockMovement,
} from "@/modules/inventory/domain/entities/stock";
import { err, ok } from "@/shared/kernel/result";
import { InvariantViolationError, NotFoundError } from "@/shared/kernel/errors";

const VARIANT_ID = "e0000000-0000-4000-8000-000000000001";

function makeMovement(
  id: string,
  type: "purchase" | "sale",
  qtyChange: number
): StockMovement {
  return StockMovement.create(
    {
      variantId: VARIANT_ID,
      type,
      qtyChange,
      balanceAfter: 100 + qtyChange,
      refType: "seed",
      refId: null,
      note: "Stok awal seed",
      createdBy: null,
    },
    id,
    new Date("2026-10-05T00:00:00Z")
  );
}

describe("GetStockCardUseCase", () => {
  function setup(movements: StockMovement[]) {
    const stocks: IStockRepository = {
      getByVariantId: async () =>
        ok(Stock.create({ variantId: VARIANT_ID, qty: 100 })),
      listOverview: async () =>
        ok({ items: [], total: 0, page: 1, pageSize: 20 }),
      getOverviewByVariantId: async () =>
        ok({
          variantId: VARIANT_ID,
          productId: "p-1",
          productName: "Beras",
          variantName: "",
          sku: "BRS",
          barcode: null,
          categoryId: null,
          categoryName: null,
          minStock: 10,
          trackStock: true,
          qty: 100,
          status: "normal",
        }),
      adjustStock: async () => {
        throw new InvariantViolationError("not used");
      },
      countLowStock: async () => ok(0),
      countExpiringBatches: async () => ok(0),
      listExpiringBatches: async () =>
        ok({ items: [], total: 0, page: 1, pageSize: 20 }),
      listBatchesByVariant: async () => ok([]),
    };
    const movementRepo: IStockMovementRepository = {
      create: async () => err(new InvariantViolationError("not used")),
      findByVariantId: async (filter) => {
        const filtered = filter.type
          ? movements.filter((m) => m.type === filter.type)
          : movements;
        return ok({
          overview: null,
          movements: filtered,
          total: filtered.length,
          page: 1,
          pageSize: 20,
        });
      },
    };
    return new GetStockCardUseCase(stocks, movementRepo);
  }

  it("mengembalikan riwayat pergerakan varian", async () => {
    const useCase = setup([makeMovement("m-1", "purchase", 100)]);
    const result = await useCase.execute({ variantId: VARIANT_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.movements).toHaveLength(1);
      expect(result.data.movements[0]?.typeLabel).toBe("Pembelian");
    }
  });

  it("filter per tipe pergerakan", async () => {
    const useCase = setup([
      makeMovement("m-1", "purchase", 100),
      makeMovement("m-2", "sale", -2),
    ]);
    const result = await useCase.execute({
      variantId: VARIANT_ID,
      type: "sale",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.movements).toHaveLength(1);
      expect(result.data.movements[0]?.type).toBe("sale");
    }
  });

  it("menolak variantId bukan UUID", async () => {
    const useCase = setup([]);
    const result = await useCase.execute({ variantId: "bukan-uuid" });
    expect(result.success).toBe(false);
  });

  it("NotFoundError tersedia untuk saldo hilang", () => {
    expect(new NotFoundError("Stok", VARIANT_ID).code).toBe("NOT_FOUND");
  });
});

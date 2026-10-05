import { describe, expect, it } from "vitest";
import {
  HoldSaleUseCase,
  MAX_HELD_PER_USER,
  ResumeSaleUseCase,
} from "@/modules/sales/application/use-cases/hold.use-cases";
import type { ISaleRepository } from "@/modules/sales/domain/repositories/sale.repository";
import { ValidationError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";
import { InvariantViolationError } from "@/shared/kernel/errors";

function setup(heldCount: number) {
  const repo: ISaleRepository = {
    createSale: async () => {
      throw new InvariantViolationError("not used");
    },
    findReceiptById: async () => ok(null),
    findReceiptByInvoice: async () => ok(null),
    findReceiptByIdempotencyKey: async () => ok(null),
    voidSale: async () => {
      throw new InvariantViolationError("not used");
    },
    createReturn: async () => {
      throw new InvariantViolationError("not used");
    },
    listReturns: async () => ok({ items: [], total: 0, page: 1, pageSize: 20 }),
    holdSale: async () => ok({ saleId: "h-1", holdNo: "HOLD-1" }),
    resumeSale: async (saleId) =>
      ok({
        saleId,
        holdNo: "HOLD-1",
        customerId: null,
        discountTotal: 0,
        items: [],
      }),
    listHeldSales: async () =>
      ok(
        Array.from({ length: heldCount }, (_, i) => ({
          saleId: `h-${i}`,
          holdNo: `HOLD-${i}`,
          customerId: null,
          itemCount: 1,
          totalQty: 1,
          grandTotal: 1000,
          createdAt: new Date(),
        }))
      ),
  };
  return {
    holdUseCase: new HoldSaleUseCase(repo),
    resumeUseCase: new ResumeSaleUseCase(repo),
  };
}

describe("HoldSaleUseCase", () => {
  const items = [
    { variantId: "e0000000-0000-4000-8000-000000000005", qty: 2, discount: 0 },
  ];

  it("hold keranjang berisi", async () => {
    const { holdUseCase } = setup(2);
    const result = await holdUseCase.execute("u-1", { items });
    expect(result.success).toBe(true);
  });

  it("menolak keranjang kosong", async () => {
    const { holdUseCase } = setup(0);
    const result = await holdUseCase.execute("u-1", { items: [] });
    expect(result.success).toBe(false);
  });

  it(`menolak bila sudah ${MAX_HELD_PER_USER} hold`, async () => {
    const { holdUseCase } = setup(MAX_HELD_PER_USER);
    const result = await holdUseCase.execute("u-1", { items });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });
});

describe("ResumeSaleUseCase", () => {
  it("resume hold", async () => {
    const { resumeUseCase } = setup(1);
    const result = await resumeUseCase.execute("h-0", false);
    expect(result.success).toBe(true);
  });
});

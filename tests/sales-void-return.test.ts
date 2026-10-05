import { describe, expect, it } from "vitest";
import {
  CreateReturnUseCase,
  VoidSaleUseCase,
} from "@/modules/sales/application/use-cases/void-return.use-cases";
import type { ISaleRepository } from "@/modules/sales/domain/repositories/sale.repository";
import { Sale, SaleItem } from "@/modules/sales/domain/entities/sale";
import { Money } from "@/shared/lib/money";
import { ValidationError } from "@/shared/kernel/errors";
import { SaleNotFoundError } from "@/modules/sales/domain/errors";
import { ok } from "@/shared/kernel/result";
import { InvariantViolationError } from "@/shared/kernel/errors";

const SALE_ID = "cab74b14-e9f4-4a7d-9c9c-8c26d79da4b1";
const ITEM_ID = "d9bd3a5c-67d2-4897-afde-23f8169eae81";

function makeReceipt(
  status: "completed" | "void" | "partial_return" = "completed",
  returnedQty = 0
) {
  const sale = Sale.create(
    {
      invoiceNo: "INV-20261005-0001",
      idempotencyKey: "k-1",
      shiftId: null,
      userId: "u-1",
      customerId: null,
      subtotal: Money.create(14000),
      discountTotal: Money.create(0),
      taxTotal: Money.create(0),
      serviceFee: Money.create(0),
      rounding: Money.create(0),
      grandTotal: Money.create(14000),
      paidTotal: Money.create(14000),
      changeAmount: Money.create(0),
      status,
    },
    SALE_ID
  );
  const item = SaleItem.create(
    {
      saleId: SALE_ID,
      variantId: "v-1",
      productName: "Mie Instan",
      sku: "MIE-GRG",
      qty: 4,
      unitPrice: Money.create(3500),
      costPrice: Money.create(2900),
      discount: Money.create(0),
      subtotal: Money.create(14000),
      returnedQty,
    },
    ITEM_ID
  );
  return { sale, items: [item], payments: [] };
}

function setup(
  status: "completed" | "void" | "partial_return" = "completed",
  returnedQty = 0
) {
  const receipt = makeReceipt(status, returnedQty);
  const repo: ISaleRepository = {
    createSale: async () => {
      throw new InvariantViolationError("not used");
    },
    findReceiptById: async (id) => ok(id === SALE_ID ? receipt : null),
    findReceiptByInvoice: async () => ok(null),
    findReceiptByIdempotencyKey: async () => ok(null),
    voidSale: async () => ok(makeReceipt("void", 4)),
    createReturn: async () =>
      ok({
        returnId: "r-1",
        totalRefund: 3500,
        receipt,
      }),
    listReturns: async () => ok({ items: [], total: 0, page: 1, pageSize: 20 }),
    holdSale: async () => {
      throw new InvariantViolationError("not used");
    },
    resumeSale: async () => {
      throw new InvariantViolationError("not used");
    },
    listHeldSales: async () => ok([]),
  };
  return {
    voidUseCase: new VoidSaleUseCase(repo),
    returnUseCase: new CreateReturnUseCase(repo),
  };
}

describe("VoidSaleUseCase", () => {
  it("void butuh alasan", async () => {
    const { voidUseCase } = setup();
    const result = await voidUseCase.execute(
      { userId: "u-1", canVoid: true },
      SALE_ID,
      { reason: "  " }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("tanpa permission ditolak", async () => {
    const { voidUseCase } = setup();
    const result = await voidUseCase.execute(
      { userId: "u-9", canVoid: false },
      SALE_ID,
      { reason: "salah" }
    );
    expect(result.success).toBe(false);
  });

  it("sale void tidak bisa di-void lagi", async () => {
    const { voidUseCase } = setup("void");
    const result = await voidUseCase.execute(
      { userId: "u-1", canVoid: true },
      SALE_ID,
      { reason: "lagi" }
    );
    expect(result.success).toBe(false);
  });

  it("sale tidak ada -> NotFound", async () => {
    const { voidUseCase } = setup();
    const result = await voidUseCase.execute(
      { userId: "u-1", canVoid: true },
      "sale-tidak-ada",
      { reason: "x" }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(SaleNotFoundError);
    }
  });
});

describe("CreateReturnUseCase", () => {
  const pm = "10000000-0000-4000-8000-000000000001";

  it("retur parsial valid", async () => {
    const { returnUseCase } = setup();
    const result = await returnUseCase.execute(
      { userId: "u-1", canReturn: true },
      SALE_ID,
      {
        items: [{ saleItemId: ITEM_ID, qty: 1 }],
        refundMethodId: pm,
        reason: "cacat",
      }
    );
    expect(result.success).toBe(true);
  });

  it("retur melebihi sisa ditolak", async () => {
    const { returnUseCase } = setup("partial_return", 3);
    const result = await returnUseCase.execute(
      { userId: "u-1", canReturn: true },
      SALE_ID,
      {
        items: [{ saleItemId: ITEM_ID, qty: 2 }],
        refundMethodId: pm,
        reason: "kelebihan",
      }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("item di luar transaksi ditolak", async () => {
    const { returnUseCase } = setup();
    const result = await returnUseCase.execute(
      { userId: "u-1", canReturn: true },
      SALE_ID,
      {
        items: [{ saleItemId: "item-asing", qty: 1 }],
        refundMethodId: pm,
        reason: "x",
      }
    );
    expect(result.success).toBe(false);
  });

  it("tanpa permission ditolak", async () => {
    const { returnUseCase } = setup();
    const result = await returnUseCase.execute(
      { userId: "u-9", canReturn: false },
      SALE_ID,
      {
        items: [{ saleItemId: ITEM_ID, qty: 1 }],
        refundMethodId: pm,
        reason: "x",
      }
    );
    expect(result.success).toBe(false);
  });
});

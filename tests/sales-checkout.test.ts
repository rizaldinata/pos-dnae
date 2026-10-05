import { describe, expect, it } from "vitest";
import { CheckoutUseCase } from "@/modules/sales/application/use-cases/checkout.use-case";
import type {
  CreateSaleRecord,
  ISaleRepository,
} from "@/modules/sales/domain/repositories/sale.repository";
import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { IStockRepository } from "@/modules/inventory/domain/repositories/stock.repository";
import type { IShiftRepository } from "@/modules/shifts/domain/repositories/shift.repository";
import { Shift } from "@/modules/shifts/domain/entities/shift";
import { Money as ShiftMoney } from "@/shared/lib/money";
import { ProductVariant } from "@/modules/catalog/domain/entities/product";
import { Sku } from "@/modules/catalog/domain/value-objects/sku";
import { Money } from "@/shared/lib/money";
import {
  Sale,
  SaleItem,
  SalePayment,
} from "@/modules/sales/domain/entities/sale";
import { Stock } from "@/modules/inventory/domain/entities/stock";
import {
  UnderpaidError,
  InsufficientStockError,
} from "@/modules/sales/domain/errors";
import { NoOpenShiftError } from "@/modules/shifts/domain/errors";
import {
  NotFoundError,
  ValidationError,
  InvariantViolationError,
} from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";

const VARIANT_ID = "e0000000-0000-4000-8000-000000000005";

function makeVariant(): ProductVariant {
  return ProductVariant.create(
    {
      productId: "p-1",
      sku: Sku.create("MIE-GRG"),
      barcode: null,
      variantName: "Goreng",
      costPrice: Money.create(2900),
      sellPrice: Money.create(3500),
      minStock: 0,
      trackStock: true,
      stockQty: 100,
    },
    VARIANT_ID
  );
}

function makeReceipt(id: string, key: string) {
  const sale = Sale.create(
    {
      invoiceNo: "INV-20261005-0001",
      idempotencyKey: key,
      shiftId: null,
      userId: "u-1",
      customerId: null,
      subtotal: Money.create(7000),
      discountTotal: Money.create(0),
      taxTotal: Money.create(0),
      serviceFee: Money.create(0),
      rounding: Money.create(0),
      grandTotal: Money.create(7000),
      paidTotal: Money.create(7000),
      changeAmount: Money.create(0),
      status: "completed",
    },
    id
  );
  return { sale, items: [] as SaleItem[], payments: [] as SalePayment[] };
}

describe("CheckoutUseCase", () => {
  function setup(options?: {
    stockQty?: number;
    variantExists?: boolean;
    existingReceipt?: boolean;
    openShift?: boolean;
  }) {
    const stockQty = options?.stockQty ?? 100;
    const variantExists = options?.variantExists ?? true;
    let created = 0;
    let lastRecord: CreateSaleRecord | null = null;

    const products: IProductRepository = {
      findById: async () => ok(null),
      findVariantById: async () =>
        ok(
          variantExists
            ? { variant: makeVariant(), productName: "Mie Instan" }
            : null
        ),
      findBySku: async () => ok(null),
      findByBarcode: async () => ok(null),
      search: async () => ok({ items: [], total: 0, page: 1, pageSize: 20 }),
      create: async () => {
        throw new InvariantViolationError("not used");
      },
      update: async () => {
        throw new InvariantViolationError("not used");
      },
      softDelete: async () => ok(undefined),
    };
    const stocks: IStockRepository = {
      getByVariantId: async () =>
        ok(Stock.create({ variantId: VARIANT_ID, qty: stockQty })),
      listOverview: async () =>
        ok({ items: [], total: 0, page: 1, pageSize: 20 }),
      getOverviewByVariantId: async () => ok(null),
    };
    const sales: ISaleRepository = {
      createSale: async (record: CreateSaleRecord) => {
        created += 1;
        lastRecord = record;
        return ok(makeReceipt(`sale-${created}`, record.idempotencyKey));
      },
      findReceiptById: async () => ok(null),
      findReceiptByInvoice: async () => ok(null),
      findReceiptByIdempotencyKey: async (key) =>
        ok(options?.existingReceipt ? makeReceipt("sale-lama", key) : null),
    };
    const shifts: IShiftRepository = {
      openShift: async () => {
        throw new InvariantViolationError("not used");
      },
      getCurrentShift: async () =>
        ok(
          options?.openShift === false
            ? null
            : Shift.create(
                {
                  userId: "u-1",
                  openedAt: new Date(),
                  closedAt: null,
                  openingCash: ShiftMoney.create(50000),
                  expectedCash: null,
                  closingCash: null,
                  difference: null,
                  status: "open",
                },
                "shift-1"
              )
        ),
      findById: async () => ok(null),
      closeShift: async () => {
        throw new InvariantViolationError("not used");
      },
      getSummary: async () => {
        throw new InvariantViolationError("not used");
      },
      addCashMovement: async () => {
        throw new InvariantViolationError("not used");
      },
      listShifts: async () =>
        ok({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    return {
      useCase: new CheckoutUseCase(sales, products, stocks, shifts),
      createdCount: () => created,
      lastRecord: () => lastRecord,
    };
  }

  const tunai = "10000000-0000-4000-8000-000000000001";

  it("checkout tunai sukses dengan hitung ulang server", async () => {
    const { useCase, createdCount, lastRecord } = setup();
    const result = await useCase.execute(
      { userId: "u-1", idempotencyKey: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        payments: [{ paymentMethodId: tunai, amount: 7000 }],
      }
    );
    expect(result.success).toBe(true);
    expect(createdCount()).toBe(1);
    if (result.success) {
      expect(result.data.sale.grandTotal.amount).toBe(7000);
    }
    expect(lastRecord()?.shiftId).toBe("shift-1");
  });

  it("menolak checkout tanpa shift terbuka", async () => {
    const { useCase, createdCount } = setup({ openShift: false });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 1 }],
        payments: [{ paymentMethodId: tunai, amount: 99999 }],
      }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NoOpenShiftError);
    }
    expect(createdCount()).toBe(0);
  });

  it("menolak keranjang kosong", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(
      { userId: "u-1" },
      { items: [], payments: [] }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("menolak pembayaran kurang", async () => {
    const { useCase, createdCount } = setup();
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        payments: [{ paymentMethodId: tunai, amount: 1000 }],
      }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UnderpaidError);
    }
    expect(createdCount()).toBe(0);
  });

  it("menolak stok tidak cukup", async () => {
    const { useCase, createdCount } = setup({ stockQty: 1 });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 5 }],
        payments: [{ paymentMethodId: tunai, amount: 99999 }],
      }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InsufficientStockError);
    }
    expect(createdCount()).toBe(0);
  });

  it("menolak varian yang tidak ada", async () => {
    const { useCase } = setup({ variantExists: false });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 1 }],
        payments: [{ paymentMethodId: tunai, amount: 99999 }],
      }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it("idempotency key yang sama mengembalikan struk lama tanpa buat baru", async () => {
    const { useCase, createdCount } = setup({ existingReceipt: true });
    const result = await useCase.execute(
      { userId: "u-1", idempotencyKey: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb" },
      {
        items: [{ variantId: VARIANT_ID, qty: 1 }],
        payments: [{ paymentMethodId: tunai, amount: 99999 }],
      }
    );
    expect(result.success).toBe(true);
    expect(createdCount()).toBe(0);
    if (result.success) {
      expect(result.data.sale.id).toBe("sale-lama");
    }
  });

  it("diskon item diteruskan sebagai nominal ke repository", async () => {
    const { useCase, lastRecord } = setup();
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [
          {
            variantId: VARIANT_ID,
            qty: 2,
            discount: { kind: "percent", value: 10 },
          },
        ],
        payments: [{ paymentMethodId: tunai, amount: 6300 }],
      }
    );
    expect(result.success).toBe(true);
    // 10% dari 7000 = 700 diteruskan sebagai nominal agar RPC verifikasi ulang
    expect(lastRecord()?.items[0]?.discount).toBe(700);
  });
});

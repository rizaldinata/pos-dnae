import { describe, expect, it } from "vitest";
import { CheckoutUseCase } from "@/modules/sales/application/use-cases/checkout.use-case";
import type {
  CreateSaleRecord,
  ISaleRepository,
} from "@/modules/sales/domain/repositories/sale.repository";
import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { IStockRepository } from "@/modules/inventory/domain/repositories/stock.repository";
import type { IShiftRepository } from "@/modules/shifts/domain/repositories/shift.repository";
import type { IPriceTierRepository } from "@/modules/catalog/domain/repositories/price-tier.repository";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import type { ICustomerRepository } from "@/modules/customers/domain/repositories/customer.repository";
import type {
  IPromotionRepository,
  IVoucherRepository,
} from "@/modules/promotions/domain/repositories/promotion.repository";
import { Customer } from "@/modules/customers/domain/entities/customer";
import {
  Promotion,
  Voucher,
} from "@/modules/promotions/domain/entities/promotion";
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
const CUSTOMER_ID = "c0000000-0000-4000-8000-000000000001";

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
    taxRate?: number;
    promotions?: Promotion[];
    vouchers?: Voucher[];
    customerPoints?: number;
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
            ? {
                variant: makeVariant(),
                productName: "Mie Instan",
                productId: "p-1",
                categoryId: null,
              }
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
      adjustStock: async () => {
        throw new InvariantViolationError("not used");
      },
      countLowStock: async () => ok(0),
      countExpiringBatches: async () => ok(0),
      listExpiringBatches: async () =>
        ok({ items: [], total: 0, page: 1, pageSize: 20 }),
      listBatchesByVariant: async () => ok([]),
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
      voidSale: async () => {
        throw new InvariantViolationError("not used");
      },
      createReturn: async () => {
        throw new InvariantViolationError("not used");
      },
      listReturns: async () =>
        ok({ items: [], total: 0, page: 1, pageSize: 20 }),
      holdSale: async () => {
        throw new InvariantViolationError("not used");
      },
      resumeSale: async () => {
        throw new InvariantViolationError("not used");
      },
      listHeldSales: async () => ok([]),
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
    const priceTiers: IPriceTierRepository = {
      listByVariant: async () => ok([]),
      listByVariantIds: async () => ok({}),
      setTiers: async () => ok([]),
    };
    const taxRate = options?.taxRate ?? 0;
    const settings: ISettingsRepository = {
      getAll: async () =>
        ok({
          "tax.rate": taxRate,
          "tax.mode": "exclusive",
          "service_fee.rate": 0,
        }),
      get: async () => ok(null),
      set: async () => ok(undefined),
      setMany: async () => ok(undefined),
    };
    const customers: ICustomerRepository = {
      findById: async (id) =>
        ok(
          id === CUSTOMER_ID
            ? Customer.create(
                {
                  name: "Budi",
                  phone: "",
                  email: "",
                  address: "",
                  points: options?.customerPoints ?? 0,
                  receivableBalance: 0,
                },
                CUSTOMER_ID
              )
            : null
        ),
      search: async () => ok({ items: [], total: 0, page: 1, pageSize: 20 }),
      create: async () => {
        throw new InvariantViolationError("not used");
      },
      update: async () => {
        throw new InvariantViolationError("not used");
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
    const promotions: IPromotionRepository = {
      findById: async () => ok(null),
      findActive: async () => ok(options?.promotions ?? []),
      findAll: async () => ok([]),
      create: async () => {
        throw new InvariantViolationError("not used");
      },
      update: async () => {
        throw new InvariantViolationError("not used");
      },
      toggleActive: async () => {
        throw new InvariantViolationError("not used");
      },
    };
    const vouchers: IVoucherRepository = {
      findById: async () => ok(null),
      findByCode: async (code) =>
        ok(
          options?.vouchers?.find(
            (v) => v.code === code.trim().toUpperCase()
          ) ?? null
        ),
      findAll: async () => ok([]),
      create: async () => {
        throw new InvariantViolationError("not used");
      },
      update: async () => {
        throw new InvariantViolationError("not used");
      },
    };
    return {
      useCase: new CheckoutUseCase(
        sales,
        products,
        stocks,
        shifts,
        priceTiers,
        settings,
        customers,
        promotions,
        vouchers
      ),
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

  it("pajak eksklusif 10% dihitung server dan diteruskan", async () => {
    const { useCase, lastRecord } = setup({ taxRate: 10 });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        payments: [{ paymentMethodId: tunai, amount: 7700 }],
      }
    );
    // 7000 + pajak 10% = 7700
    expect(result.success).toBe(true);
    expect(lastRecord()?.taxTotal).toBe(700);
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
  it("kredit butuh pelanggan terdaftar", async () => {
    const { useCase } = setup();
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        isCredit: true,
        items: [{ variantId: VARIANT_ID, qty: 1 }],
        payments: [],
      }
    );
    expect(result.success).toBe(false);
  });

  it("promo persen otomatis diterapkan dan dicatat ke transaksi", async () => {
    const promo = Promotion.create(
      {
        name: "Diskon 10%",
        type: "percent",
        scope: "all",
        scopeRefId: null,
        value: Money.create(10),
        buyQty: 0,
        getQty: 0,
        minPurchase: Money.create(0),
        startAt: new Date("2026-10-01T00:00:00Z"),
        endAt: new Date("2026-12-31T00:00:00Z"),
        isActive: true,
      },
      "promo-10"
    );
    const { useCase, lastRecord } = setup({ promotions: [promo] });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        payments: [{ paymentMethodId: tunai, amount: 6300 }],
      }
    );
    expect(result.success).toBe(true);
    // 10% dari 7000 = 700 diteruskan ke RPC sebagai diskon baris
    expect(lastRecord()?.items[0]?.discount).toBe(700);
    expect(lastRecord()?.promotionIds).toEqual(["promo-10"]);
  });

  it("promo yang sudah selesai tidak mengurangi total", async () => {
    const promo = Promotion.create(
      {
        name: "Selesai",
        type: "percent",
        scope: "all",
        scopeRefId: null,
        value: Money.create(50),
        buyQty: 0,
        getQty: 0,
        minPurchase: Money.create(0),
        startAt: new Date("2026-01-01T00:00:00Z"),
        endAt: new Date("2026-02-01T00:00:00Z"),
        isActive: true,
      },
      "promo-lama"
    );
    const { useCase, lastRecord } = setup({ promotions: [promo] });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        payments: [{ paymentMethodId: tunai, amount: 7000 }],
      }
    );
    expect(result.success).toBe(true);
    expect(lastRecord()?.items[0]?.discount).toBe(0);
    expect(lastRecord()?.promotionIds).toEqual([]);
  });

  it("voucher mengurangi tagihan dan diteruskan ke RPC", async () => {
    const voucher = Voucher.create(
      {
        code: "hemat",
        type: "percent",
        value: Money.create(10),
        quota: 5,
        usedCount: 0,
        minPurchase: Money.create(0),
        expiresAt: null,
        isActive: true,
      },
      "voucher-1"
    );

    const denganVoucher = setup({ vouchers: [voucher] });
    const okResult = await denganVoucher.useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        voucherCode: "hemat",
        payments: [{ paymentMethodId: tunai, amount: 6300 }],
      }
    );
    expect(okResult.success).toBe(true);
    expect(denganVoucher.lastRecord()?.voucherCode).toBe("HEMAT");

    // Tanpa voucher, 6300 kurang dari total 7000
    const tanpaVoucher = setup();
    const gagal = await tanpaVoucher.useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        payments: [{ paymentMethodId: tunai, amount: 6300 }],
      }
    );
    expect(gagal.success).toBe(false);
    if (!gagal.success) {
      expect(gagal.error).toBeInstanceOf(UnderpaidError);
    }
  });

  it("voucher kedaluwarsa ditolak saat checkout", async () => {
    const voucher = Voucher.create(
      {
        code: "lama",
        type: "amount",
        value: Money.create(5000),
        quota: 5,
        usedCount: 0,
        minPurchase: Money.create(0),
        expiresAt: new Date("2026-01-01T00:00:00Z"),
        isActive: true,
      },
      "voucher-lama"
    );
    const { useCase } = setup({ vouchers: [voucher] });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        voucherCode: "LAMA",
        payments: [{ paymentMethodId: tunai, amount: 7000 }],
      }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("item gratis BOGO diteruskan sebagai baris gift", async () => {
    const bogo = Promotion.create(
      {
        name: "Beli 1 Gratis 1",
        type: "bogo",
        scope: "all",
        scopeRefId: null,
        value: Money.create(0),
        buyQty: 1,
        getQty: 1,
        minPurchase: Money.create(0),
        startAt: new Date("2026-10-01T00:00:00Z"),
        endAt: new Date("2026-12-31T00:00:00Z"),
        isActive: true,
      },
      "promo-bogo"
    );
    const { useCase, lastRecord } = setup({ promotions: [bogo] });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        payments: [{ paymentMethodId: tunai, amount: 7000 }],
      }
    );
    expect(result.success).toBe(true);
    const items = lastRecord()?.items ?? [];
    expect(items).toHaveLength(2);
    const gift = items.find((i) => i.isGift);
    expect(gift?.qty).toBe(2);
    expect(gift?.discount).toBe(0);
    expect(lastRecord()?.promotionIds).toEqual(["promo-bogo"]);
  });

  it("penukaran poin memotong dasar perpajakan dan diteruskan ke RPC", async () => {
    const { useCase, lastRecord } = setup({
      taxRate: 10,
      customerPoints: 500,
    });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        customerId: CUSTOMER_ID,
        redeemPoints: 10,
        payments: [{ paymentMethodId: tunai, amount: 99999 }],
      }
    );
    // 7000 - 10 poin × Rp100 = 6000, pajak 10% = 600.
    expect(result.success).toBe(true);
    expect(lastRecord()?.redeemPoints).toBe(10);
    expect(lastRecord()?.taxTotal).toBe(600);
  });

  it("menolak penukaran poin melebihi saldo pelanggan", async () => {
    const { useCase, createdCount } = setup({ customerPoints: 5 });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        customerId: CUSTOMER_ID,
        redeemPoints: 10,
        payments: [{ paymentMethodId: tunai, amount: 7000 }],
      }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toBe("Poin pelanggan tidak cukup");
    }
    expect(createdCount()).toBe(0);
  });

  it("menolak penukaran poin melebihi sisa tagihan", async () => {
    const { useCase, createdCount } = setup({ customerPoints: 500 });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        customerId: CUSTOMER_ID,
        redeemPoints: 100,
        payments: [{ paymentMethodId: tunai, amount: 7000 }],
      }
    );
    // 100 poin × Rp100 = Rp10.000 > tagihan Rp7.000.
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("Poin melebihi sisa tagihan");
    }
    expect(createdCount()).toBe(0);
  });

  it("menolak penukaran poin tanpa pelanggan", async () => {
    const { useCase, createdCount } = setup({ customerPoints: 500 });
    const result = await useCase.execute(
      { userId: "u-1" },
      {
        items: [{ variantId: VARIANT_ID, qty: 2 }],
        redeemPoints: 10,
        payments: [{ paymentMethodId: tunai, amount: 7000 }],
      }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe(
        "Penukaran poin wajib memilih pelanggan"
      );
    }
    expect(createdCount()).toBe(0);
  });
});

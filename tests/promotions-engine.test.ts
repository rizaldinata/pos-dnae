import { describe, expect, it } from "vitest";
import {
  Promotion,
  type PromotionProps,
} from "@/modules/promotions/domain/entities/promotion";
import { PromotionEngine } from "@/modules/promotions/domain/services/promotion-engine";
import { Money } from "@/shared/lib/money";

const NOW = new Date("2026-10-05T10:00:00Z");

function promo(
  overrides: Partial<PromotionProps> = {},
  id = "promo-1"
): Promotion {
  return Promotion.create(
    {
      name: "Promo",
      type: "percent",
      scope: "all",
      scopeRefId: null,
      value: Money.create(10),
      buyQty: 0,
      getQty: 0,
      minPurchase: Money.create(0),
      startAt: new Date("2026-10-01T00:00:00Z"),
      endAt: new Date("2026-10-31T23:59:59Z"),
      isActive: true,
      ...overrides,
    },
    id
  );
}

const LINE = {
  variantId: "v-1",
  productId: "p-1",
  categoryId: "cat-1",
  qty: 3,
  unitPrice: 3500,
};

describe("PromotionEngine", () => {
  it("menerapkan diskon persen pada semua produk", () => {
    const result = PromotionEngine.evaluate([LINE], [promo()], NOW, 10500);
    expect(result.lineDiscounts.get("v-1")).toBe(1050);
    expect(result.appliedPromotionIds).toEqual(["promo-1"]);
  });

  it("membatasi diskon nominal agar tidak melebihi nilai baris", () => {
    const result = PromotionEngine.evaluate(
      [LINE],
      [promo({ type: "amount", value: Money.create(50000) })],
      NOW,
      10500
    );
    expect(result.lineDiscounts.get("v-1")).toBe(10500);
  });

  it("hanya menerapkan promo pada scope yang cocok", () => {
    const kategoriLain = promo({
      scope: "category",
      scopeRefId: "cat-lain",
    });
    const produkCocok = promo(
      { scope: "product", scopeRefId: "p-1" },
      "promo-2"
    );

    const result = PromotionEngine.evaluate(
      [LINE],
      [kategoriLain, produkCocok],
      NOW,
      10500
    );

    expect(result.lineDiscounts.get("v-1")).toBe(1050);
    expect(result.appliedPromotionIds).toEqual(["promo-2"]);
  });

  it("mengambil diskon terbesar, tidak menumpuk", () => {
    const result = PromotionEngine.evaluate(
      [LINE],
      [
        promo({ type: "percent", value: Money.create(10) }, "promo-10"),
        promo({ type: "amount", value: Money.create(1000) }, "promo-1000"),
      ],
      NOW,
      10500
    );
    expect(result.lineDiscounts.get("v-1")).toBe(1050);
    expect(result.appliedPromotionIds).toEqual(["promo-10"]);
  });

  it("mengabaikan promo yang belum mencapai minimum belanja", () => {
    const result = PromotionEngine.evaluate(
      [LINE],
      [promo({ minPurchase: Money.create(50000) })],
      NOW,
      10500
    );
    expect(result.lineDiscounts.size).toBe(0);
    expect(result.appliedPromotionIds).toEqual([]);
  });

  it("mengabaikan promo yang tidak aktif atau di luar periode", () => {
    const nonaktif = promo({ isActive: false }, "promo-nonaktif");
    const selesai = promo(
      {
        startAt: new Date("2026-09-01T00:00:00Z"),
        endAt: new Date("2026-09-30T23:59:59Z"),
      },
      "promo-selesai"
    );
    const result = PromotionEngine.evaluate(
      [LINE],
      [nonaktif, selesai],
      NOW,
      10500
    );
    expect(result.lineDiscounts.size).toBe(0);
    expect(result.appliedPromotionIds).toEqual([]);
  });

  it("menghitung item gratis BOGO per jumlah set", () => {
    const bogo = promo({ type: "bogo", buyQty: 2, getQty: 1 });
    const result = PromotionEngine.evaluate([LINE], [bogo], NOW, 10500);
    // qty 5 (bukan 3) => 2 set "beli 2" => 2 gratis
    const resultQty5 = PromotionEngine.evaluate(
      [{ ...LINE, qty: 5 }],
      [bogo],
      NOW,
      17500
    );
    expect(result.giftLines.get("v-1")).toBe(1);
    expect(resultQty5.giftLines.get("v-1")).toBe(2);
    expect(result.appliedPromotionIds).toEqual(["promo-1"]);
  });

  it("tidak memberi gratis jika qty belum mencapai qty beli", () => {
    const bogo = promo({ type: "bogo", buyQty: 2, getQty: 1 });
    const result = PromotionEngine.evaluate(
      [{ ...LINE, qty: 1 }],
      [bogo],
      NOW,
      3500
    );
    expect(result.giftLines.size).toBe(0);
    expect(result.appliedPromotionIds).toEqual([]);
  });

  it("mengabaikan BOGO tanpa konfigurasi qty beli/gratis", () => {
    const bogo = promo({ type: "bogo", buyQty: 0, getQty: 0 });
    const result = PromotionEngine.evaluate([LINE], [bogo], NOW, 10500);
    expect(result.giftLines.size).toBe(0);
  });

  it("mengabaikan baris dengan harga 0", () => {
    const result = PromotionEngine.evaluate(
      [{ ...LINE, qty: 2, unitPrice: 0 }],
      [promo()],
      NOW,
      0
    );
    expect(result.lineDiscounts.size).toBe(0);
    expect(result.appliedPromotionIds).toEqual([]);
  });
});

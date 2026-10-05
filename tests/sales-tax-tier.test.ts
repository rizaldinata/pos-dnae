import { describe, expect, it } from "vitest";
import { TaxCalculator } from "@/modules/sales/domain/services/tax-calculator";
import { priceForQty } from "@/modules/catalog/domain/entities/price-tier";
import { Money } from "@/shared/lib/money";

function tiers() {
  return [
    { minQty: 10, price: Money.create(9000) },
    { minQty: 50, price: Money.create(8000) },
  ];
}

describe("priceForQty", () => {
  it("harga reguler bila qty di bawah semua tier", () => {
    expect(priceForQty(tiers(), 5, Money.create(10000)).amount).toBe(10000);
  });

  it("tier pertama bila qty mencapai batas", () => {
    expect(priceForQty(tiers(), 10, Money.create(10000)).amount).toBe(9000);
    expect(priceForQty(tiers(), 25, Money.create(10000)).amount).toBe(9000);
  });

  it("tier terbesar yang terpenuhi", () => {
    expect(priceForQty(tiers(), 50, Money.create(10000)).amount).toBe(8000);
    expect(priceForQty(tiers(), 100, Money.create(10000)).amount).toBe(8000);
  });

  it("tanpa tier selalu harga reguler", () => {
    expect(priceForQty([], 100, Money.create(10000)).amount).toBe(10000);
  });
});

describe("TaxCalculator", () => {
  it("eksklusif: pajak + layanan ditambah", () => {
    const result = TaxCalculator.calculate(100000, {
      taxRate: 10,
      taxMode: "exclusive",
      serviceFeeRate: 5,
    });
    expect(result.taxTotal).toBe(10000);
    expect(result.serviceTotal).toBe(5000);
    expect(result.grandTotal).toBe(115000);
  });

  it("inklusif: pajak sebagai rincian, total tetap + layanan", () => {
    const result = TaxCalculator.calculate(110000, {
      taxRate: 10,
      taxMode: "inclusive",
      serviceFeeRate: 0,
    });
    expect(result.taxTotal).toBe(10000);
    expect(result.grandTotal).toBe(110000);
  });

  it("nol bila rate 0", () => {
    const result = TaxCalculator.calculate(50000, {
      taxRate: 0,
      taxMode: "exclusive",
      serviceFeeRate: 0,
    });
    expect(result).toEqual({
      taxableBase: 50000,
      taxTotal: 0,
      serviceTotal: 0,
      grandTotal: 50000,
    });
  });

  it("dasar negatif dijaga ke 0", () => {
    const result = TaxCalculator.calculate(-100, {
      taxRate: 10,
      taxMode: "exclusive",
      serviceFeeRate: 5,
    });
    expect(result.grandTotal).toBe(0);
  });
});

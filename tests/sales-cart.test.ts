import { describe, expect, it } from "vitest";
import { Cart } from "@/modules/sales/domain/entities/cart";
import { CartItem } from "@/modules/sales/domain/entities/cart-item";
import { Discount } from "@/modules/sales/domain/value-objects/discount";
import { DiscountPolicy } from "@/modules/sales/domain/services/discount-policy";
import { Money } from "@/shared/lib/money";
import { ValidationError } from "@/shared/kernel/errors";

function makeItem(
  overrides?: Partial<{ variantId: string; qty: number; unitPrice: number }>
): CartItem {
  return CartItem.create({
    variantId: overrides?.variantId ?? "v-1",
    productId: "p-1",
    productName: "Mie Instan",
    variantName: "Goreng",
    sku: "MIE-GRG",
    qty: overrides?.qty ?? 1,
    unitPrice: Money.create(overrides?.unitPrice ?? 3500),
    costPrice: Money.create(2900),
    stockQty: 100,
    trackStock: true,
    discount: null,
    note: "",
  });
}

describe("Discount value object", () => {
  it("diskon persen dihitung dari dasar", () => {
    expect(Discount.percent(10).calculate(10000)).toBe(1000);
  });

  it("diskon dibatasi maksimal sebesar dasar", () => {
    expect(Discount.amount(50000).calculate(10000)).toBe(10000);
    expect(Discount.percent(100).calculate(10000)).toBe(10000);
  });

  it("menolak persen di luar 0-100", () => {
    expect(() => Discount.percent(101)).toThrow(ValidationError);
    expect(() => Discount.percent(-1)).toThrow(ValidationError);
  });

  it("menolak nominal negatif", () => {
    expect(() => Discount.amount(-100)).toThrow(ValidationError);
  });
});

describe("Cart entity", () => {
  it("item duplikat digabung qty-nya", () => {
    const cart = Cart.empty()
      .addItem(makeItem({ qty: 1 }))
      .addItem(makeItem({ qty: 2 }));
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.qty).toBe(3);
  });

  it("menolak qty 0 atau negatif", () => {
    expect(() => makeItem({ qty: 0 })).toThrow(ValidationError);
    const cart = Cart.empty().addItem(makeItem());
    expect(() => cart.updateQty("v-1", 0)).toThrow(ValidationError);
  });

  it("hitung subtotal, diskon item, diskon transaksi, total", () => {
    const cart = Cart.empty()
      .addItem(makeItem({ variantId: "v-1", qty: 2, unitPrice: 10000 }))
      .addItem(makeItem({ variantId: "v-2", qty: 1, unitPrice: 5000 }))
      .setItemDiscount("v-1", Discount.percent(10))
      .setTransactionDiscount(Discount.amount(2000));
    const totals = cart.totals();
    // subtotal 25000, diskon item 2000, diskon transaksi 2000 -> total 21000
    expect(totals.subtotal).toBe(25000);
    expect(totals.itemDiscountTotal).toBe(2000);
    expect(totals.transactionDiscountTotal).toBe(2000);
    expect(totals.grandTotal).toBe(21000);
    expect(totals.totalQty).toBe(3);
  });

  it("hapus item dan bersihkan keranjang", () => {
    const cart = Cart.empty().addItem(makeItem()).removeItem("v-1");
    expect(cart.isEmpty()).toBe(true);
    const cart2 = Cart.empty().addItem(makeItem()).clear();
    expect(cart2.isEmpty()).toBe(true);
  });
});

describe("DiscountPolicy", () => {
  it("batas persen per role", () => {
    expect(
      DiscountPolicy.isWithinRoleLimit(Discount.percent(10), "Kasir")
    ).toBe(true);
    expect(
      DiscountPolicy.isWithinRoleLimit(Discount.percent(11), "Kasir")
    ).toBe(false);
    expect(
      DiscountPolicy.isWithinRoleLimit(Discount.percent(25), "Manajer")
    ).toBe(true);
    expect(
      DiscountPolicy.isWithinRoleLimit(Discount.percent(100), "Owner")
    ).toBe(true);
  });

  it("diskon nominal selalu lolos batas role", () => {
    expect(
      DiscountPolicy.isWithinRoleLimit(Discount.amount(999999), "Kasir")
    ).toBe(true);
  });

  it("tanpa diskon selalu lolos", () => {
    expect(DiscountPolicy.isWithinRoleLimit(null, "Kasir")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { Money } from "@/shared/lib/money";

describe("Money Value Object", () => {
  it("creates valid money instance with integer rounding", () => {
    const m = Money.create(15000);
    expect(m.amount).toBe(15000);
    expect(m.currency).toBe("IDR");

    const mRounded = Money.create(15000.8);
    expect(mRounded.amount).toBe(15001);
  });

  it("creates zero money instance", () => {
    const zero = Money.zero();
    expect(zero.amount).toBe(0);
    expect(zero.isZero()).toBe(true);
  });

  it("adds two money instances correctly", () => {
    const a = Money.create(10000);
    const b = Money.create(5000);
    const sum = a.add(b);

    expect(sum.amount).toBe(15000);
    expect(sum.currency).toBe("IDR");
  });

  it("subtracts two money instances correctly", () => {
    const a = Money.create(10000);
    const b = Money.create(3000);
    const diff = a.subtract(b);

    expect(diff.amount).toBe(7000);
  });

  it("multiplies money by a factor correctly", () => {
    const price = Money.create(10000);
    const total = price.multiply(3);
    expect(total.amount).toBe(30000);

    const discounted = price.multiply(0.85); // 15% discount
    expect(discounted.amount).toBe(8500);
  });

  it("handles comparisons correctly", () => {
    const lower = Money.create(5000);
    const higher = Money.create(10000);
    const equal = Money.create(5000);

    expect(higher.isGreaterThan(lower)).toBe(true);
    expect(lower.isLessThan(higher)).toBe(true);
    expect(lower.isGreaterThanOrEqual(equal)).toBe(true);
    expect(lower.isLessThanOrEqual(equal)).toBe(true);
  });

  it("checks positive, negative, and zero states", () => {
    expect(Money.create(100).isPositive()).toBe(true);
    expect(Money.create(-100).isNegative()).toBe(true);
    expect(Money.create(0).isZero()).toBe(true);
  });

  it("checks structural equality with another Money VO", () => {
    const a1 = Money.create(50000);
    const a2 = Money.create(50000);
    const b = Money.create(25000);

    expect(a1.equals(a2)).toBe(true);
    expect(a1.equals(b)).toBe(false);
    expect(a1.equals(null)).toBe(false);
  });

  it("formats amount using Rupiah format", () => {
    const m = Money.create(250000);
    expect(m.format()).toBe("Rp 250.000");
    expect(m.format(false)).toBe("250.000");
  });

  it("throws error when operating across mismatched currencies", () => {
    const idr = Money.create(1000, "IDR");
    const usd = Money.create(10, "USD");

    expect(() => idr.add(usd)).toThrowError(/different currencies/);
  });
});

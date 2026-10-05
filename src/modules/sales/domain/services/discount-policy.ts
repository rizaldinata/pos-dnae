import { Discount } from "@/modules/sales/domain/value-objects/discount";

/**
 * Batas diskon per role (persen maksimal). Dipindah ke settings di fase 2+.
 */
export const DEFAULT_MAX_DISCOUNT_PERCENT_BY_ROLE: Record<string, number> = {
  Owner: 100,
  Admin: 100,
  Manajer: 25,
  Kasir: 10,
};

export class DiscountPolicy {
  /**
   * Diskon tidak boleh melebihi nilai dasar (per item maupun transaksi).
   * calculate() pada Discount sudah clamp, fungsi ini untuk validasi eksplisit.
   */
  public static isWithinBase(
    discount: Discount | null,
    baseAmount: number
  ): boolean {
    if (!discount || discount.isZero()) {
      return true;
    }
    return discount.calculate(baseAmount) <= baseAmount;
  }

  public static maxPercentForRole(roleName: string): number {
    return DEFAULT_MAX_DISCOUNT_PERCENT_BY_ROLE[roleName] ?? 0;
  }

  public static isWithinRoleLimit(
    discount: Discount | null,
    roleName: string
  ): boolean {
    if (!discount || discount.isZero()) {
      return true;
    }
    if (discount.kind === "amount") {
      return true;
    }
    return discount.value <= DiscountPolicy.maxPercentForRole(roleName);
  }
}

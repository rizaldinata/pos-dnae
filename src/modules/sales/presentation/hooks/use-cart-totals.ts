"use client";

import { useMemo } from "react";
import {
  useCartStore,
  toCartItemEntities,
} from "@/modules/sales/presentation/hooks/use-cart-store";
import { PricingCalculator } from "@/modules/sales/domain/entities/cart";
import { Discount } from "@/modules/sales/domain/value-objects/discount";
import { TaxCalculator } from "@/modules/sales/domain/services/tax-calculator";

export function useCartTotals() {
  const items = useCartStore((s) => s.items);
  const transactionDiscount = useCartStore((s) => s.transactionDiscount);
  const pricing = useCartStore((s) => s.pricing);

  return useMemo(() => {
    const entities = toCartItemEntities(items);
    let trx: Discount | null = null;
    try {
      trx = transactionDiscount
        ? transactionDiscount.kind === "percent"
          ? Discount.percent(Math.min(transactionDiscount.value, 100))
          : Discount.amount(transactionDiscount.value)
        : null;
    } catch {
      trx = null;
    }
    const pricingTotals = PricingCalculator.calculate(entities, trx);
    const tax = TaxCalculator.calculate(
      pricingTotals.subtotal -
        pricingTotals.itemDiscountTotal -
        pricingTotals.transactionDiscountTotal,
      pricing
    );
    return { entities, pricingTotals, tax };
  }, [items, transactionDiscount, pricing]);
}

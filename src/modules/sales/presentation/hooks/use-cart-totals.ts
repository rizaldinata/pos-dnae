"use client";

import { useMemo } from "react";
import {
  useCartStore,
  toCartItemEntities,
} from "@/modules/sales/presentation/hooks/use-cart-store";
import { PricingCalculator } from "@/modules/sales/domain/entities/cart";
import { Discount } from "@/modules/sales/domain/value-objects/discount";
import { TaxCalculator } from "@/modules/sales/domain/services/tax-calculator";
import { PromotionEngine } from "@/modules/promotions/domain/services/promotion-engine";
import { Promotion } from "@/modules/promotions/domain/entities/promotion";
import { Money } from "@/shared/lib/money";

export interface PromoGiftPreview {
  variantId: string;
  displayName: string;
  qty: number;
}

export function useCartTotals() {
  const items = useCartStore((s) => s.items);
  const transactionDiscount = useCartStore((s) => s.transactionDiscount);
  const pricing = useCartStore((s) => s.pricing);
  const promotions = useCartStore((s) => s.promotions);
  const voucher = useCartStore((s) => s.voucher);
  const redeem = useCartStore((s) => s.redeem);

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

    // Promo otomatis (client preview; server memverifikasi ulang saat checkout).
    const promoEntities = promotions.map((p) =>
      Promotion.create(
        {
          name: p.name,
          type: p.type,
          scope: p.scope,
          scopeRefId: p.scopeRefId,
          value: Money.create(p.value),
          buyQty: p.buyQty,
          getQty: p.getQty,
          minPurchase: Money.create(p.minPurchase),
          startAt: new Date(p.startAt),
          endAt: new Date(p.endAt),
          isActive: p.isActive,
        },
        p.id
      )
    );
    const engineResult = PromotionEngine.evaluate(
      items.map((data, index) => ({
        variantId: data.variantId,
        productId: data.productId,
        categoryId: data.categoryId,
        qty: data.qty,
        unitPrice: entities[index]?.unitPrice.amount ?? data.unitPrice,
      })),
      promoEntities,
      new Date(),
      pricingTotals.subtotal
    );

    // Diskon efektif per baris = terbesar (manual vs promo).
    const promoLineDiscounts = new Map<string, number>();
    const promoExtraByLine = new Map<string, number>();
    let promoExtraTotal = 0;
    for (const entity of entities) {
      const manual = entity.discountAmount();
      const promo = engineResult.lineDiscounts.get(entity.variantId) ?? 0;
      const effective = Math.max(manual, promo);
      const extra = Math.max(promo - manual, 0);
      promoLineDiscounts.set(entity.variantId, effective);
      promoExtraByLine.set(entity.variantId, extra);
      promoExtraTotal += extra;
    }

    const giftPreviews: PromoGiftPreview[] = [
      ...engineResult.giftLines.entries(),
    ].map(([variantId, qty]) => {
      const data = items.find((i) => i.variantId === variantId);
      return {
        variantId,
        displayName: data
          ? data.variantName
            ? `${data.productName} — ${data.variantName} (Gratis)`
            : `${data.productName} (Gratis)`
          : variantId,
        qty,
      };
    });

    const baseAfterDiscounts =
      pricingTotals.subtotal -
      pricingTotals.itemDiscountTotal -
      promoExtraTotal -
      pricingTotals.transactionDiscountTotal;
    const voucherDiscount = voucher
      ? Math.min(voucher.discount, Math.max(baseAfterDiscounts, 0))
      : 0;
    // Penukaran poin dipotong setelah voucher (server memvalidasi ulang).
    const baseAfterVoucher = Math.max(baseAfterDiscounts - voucherDiscount, 0);
    const redeemDiscount = redeem
      ? Math.min(redeem.discount, baseAfterVoucher)
      : 0;

    const tax = TaxCalculator.calculate(
      baseAfterVoucher - redeemDiscount,
      pricing
    );

    return {
      entities,
      pricingTotals: {
        ...pricingTotals,
        itemDiscountTotal: pricingTotals.itemDiscountTotal + promoExtraTotal,
      },
      tax,
      promoLineDiscounts,
      promoExtraByLine,
      promoExtraTotal,
      giftPreviews,
      promotionIds: engineResult.appliedPromotionIds,
      voucherDiscount,
      redeemDiscount,
      redeemPoints: redeem?.points ?? 0,
    };
  }, [items, transactionDiscount, pricing, promotions, voucher, redeem]);
}

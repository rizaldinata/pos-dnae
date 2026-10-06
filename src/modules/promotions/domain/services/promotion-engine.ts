import { Promotion } from "@/modules/promotions/domain/entities/promotion";
import { Money } from "@/shared/lib/money";

export interface EngineLineItem {
  variantId: string;
  productId: string;
  categoryId: string | null;
  qty: number;
  unitPrice: number;
}

export interface EngineResult {
  /** Diskon per variantId (nominal, sudah max dengan osok manual di luar). */
  lineDiscounts: Map<string, number>;
  /** Baris gratis BOGO: variantId -> qty gratis. */
  giftLines: Map<string, number>;
  /** ID promo yang berkontribusi (diskon > 0 atau gift). */
  appliedPromotionIds: string[];
}

export interface EvaluatedPromotion {
  promotion: Promotion;
  lineDiscounts: Map<string, number>;
  giftLines: Map<string, number>;
}

/**
 * Mesin promo murni (tanpa IO): evaluasi semua promo yang berjalan,
 * per baris ambil diskon TERBESAR (tidak menumpuk).
 */
export class PromotionEngine {
  public static evaluate(
    items: EngineLineItem[],
    promotions: Promotion[],
    now: Date,
    cartSubtotal: number
  ): EngineResult {
    const lineDiscounts = new Map<string, number>();
    const giftLines = new Map<string, number>();
    const applied = new Set<string>();

    const running = promotions.filter(
      (promo) =>
        promo.isRunning(now) && cartSubtotal >= promo.minPurchase.amount
    );

    for (const promo of running) {
      if (promo.type === "bogo") {
        const gifts = PromotionEngine.evaluateBogo(items, promo);
        for (const [variantId, qty] of gifts) {
          if (qty > 0) {
            giftLines.set(variantId, (giftLines.get(variantId) ?? 0) + qty);
            applied.add(promo.id);
          }
        }
        continue;
      }

      for (const item of items) {
        if (!promo.matches(item.productId, item.categoryId)) {
          continue;
        }
        const lineGross = item.qty * item.unitPrice;
        if (lineGross <= 0) {
          continue;
        }
        const discount =
          promo.type === "percent"
            ? Math.min(
                Math.round((lineGross * promo.value.amount) / 100),
                lineGross
              )
            : Math.min(promo.value.amount, lineGross);
        if (discount > (lineDiscounts.get(item.variantId) ?? 0)) {
          lineDiscounts.set(item.variantId, discount);
          if (discount > 0) {
            applied.add(promo.id);
          }
        }
      }
    }

    return { lineDiscounts, giftLines, appliedPromotionIds: [...applied] };
  }

  private static evaluateBogo(
    items: EngineLineItem[],
    promo: Promotion
  ): Map<string, number> {
    const gifts = new Map<string, number>();
    if (promo.buyQty <= 0 || promo.getQty <= 0) {
      return gifts;
    }
    for (const item of items) {
      if (!promo.matches(item.productId, item.categoryId)) {
        continue;
      }
      const sets = Math.floor(item.qty / promo.buyQty);
      const freeQty = sets * promo.getQty;
      if (freeQty > 0) {
        gifts.set(item.variantId, freeQty);
      }
    }
    return gifts;
  }

  public static describe(promo: {
    type: "percent" | "amount" | "bogo";
    value: Money;
    buyQty: number;
    getQty: number;
  }): string {
    if (promo.type === "percent") {
      return `Diskon ${promo.value.amount}%`;
    }
    if (promo.type === "amount") {
      return `Potongan Rp ${promo.value.amount.toLocaleString("id-ID")}`;
    }
    return `Beli ${promo.buyQty} gratis ${promo.getQty}`;
  }
}

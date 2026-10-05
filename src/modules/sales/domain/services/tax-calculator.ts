export type TaxMode = "inclusive" | "exclusive";

export interface PricingSettings {
  taxRate: number;
  taxMode: TaxMode;
  serviceFeeRate: number;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  taxRate: 0,
  taxMode: "exclusive",
  serviceFeeRate: 0,
};

export interface TaxBreakdown {
  taxableBase: number;
  taxTotal: number;
  serviceTotal: number;
  grandTotal: number;
}

/**
 * Pajak & layanan dihitung dari subtotal SETELAH diskon (PRD POS-06).
 * - exclusive: pajak & layanan ditambahkan di atas dasar.
 * - inclusive: harga sudah termasuk pajak (ditampilkan sebagai rincian).
 */
export class TaxCalculator {
  public static calculate(
    subtotalAfterDiscount: number,
    settings: PricingSettings
  ): TaxBreakdown {
    const base = Math.max(Math.round(subtotalAfterDiscount), 0);
    const rate = Math.max(settings.taxRate, 0) / 100;
    const serviceRate = Math.max(settings.serviceFeeRate, 0) / 100;

    const serviceTotal = Math.round(base * serviceRate);

    if (settings.taxMode === "inclusive") {
      const taxTotal = rate > 0 ? base - Math.round(base / (1 + rate)) : 0;
      return {
        taxableBase: base,
        taxTotal,
        serviceTotal,
        grandTotal: base + serviceTotal,
      };
    }

    const taxTotal = Math.round(base * rate);
    return {
      taxableBase: base,
      taxTotal,
      serviceTotal,
      grandTotal: base + taxTotal + serviceTotal,
    };
  }
}

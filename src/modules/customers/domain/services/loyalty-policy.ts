/**
 * Aturan loyalitas (CUS-02): perolehan poin dari transaksi dan penukaran poin
 * sebagai potongan harga (POS-14). Rasio disimpan di tabel `settings` sehingga
 * dapat diubah lewat halaman pengaturan; RPC `create_sale` membaca kunci yang
 * sama sehingga perhitungan server selalu otoritatif.
 */
export const LOYALTY_SETTING_KEYS = {
  earnRatio: "loyalty.earn_ratio",
  pointValue: "loyalty.point_value",
} as const;

export interface LoyaltySettings {
  /** Rupiah belanja yang menghasilkan 1 poin (0 = perolehan nonaktif). */
  earnRatio: number;
  /** Nilai 1 poin dalam rupiah saat ditukar (0 = penukaran nonaktif). */
  pointValue: number;
}

export const DEFAULT_LOYALTY_SETTINGS: Readonly<LoyaltySettings> =
  Object.freeze({
    earnRatio: 10000,
    pointValue: 100,
  });

export type RedeemFailureReason =
  | "invalid_points"
  | "insufficient_points"
  | "exceeds_total"
  | "loyalty_disabled";

export type RedeemCheck =
  { ok: true; discount: number } | { ok: false; reason: RedeemFailureReason };

function toNumber(value: unknown, fallback: number): number {
  const n =
    typeof value === "string"
      ? Number(value)
      : typeof value === "number"
        ? value
        : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Baca rasio loyalitas dari record settings; nilai negatif dianggap tidak sah. */
export function parseLoyaltySettings(
  record: Record<string, unknown>
): LoyaltySettings {
  return {
    earnRatio: Math.max(
      toNumber(
        record[LOYALTY_SETTING_KEYS.earnRatio],
        DEFAULT_LOYALTY_SETTINGS.earnRatio
      ),
      0
    ),
    pointValue: Math.max(
      toNumber(
        record[LOYALTY_SETTING_KEYS.pointValue],
        DEFAULT_LOYALTY_SETTINGS.pointValue
      ),
      0
    ),
  };
}

export class LoyaltyPolicy {
  /** Poin yang didapat dari nominal transaksi (dibulatkan ke bawah). */
  public static pointsForAmount(
    amount: number,
    settings: LoyaltySettings
  ): number {
    if (settings.earnRatio <= 0) {
      return 0;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }
    return Math.floor(amount / settings.earnRatio);
  }

  /** Nilai rupiah dari sejumlah poin. */
  public static valueOfPoints(
    points: number,
    settings: LoyaltySettings
  ): number {
    if (!Number.isFinite(points) || points <= 0) {
      return 0;
    }
    return Math.round(points * settings.pointValue);
  }

  /**
   * Validasi penukaran poin: jumlah valid, saldo pelanggan cukup, nilai poin
   * tidak melebihi sisa tagihan.
   */
  public static validateRedeem(
    customerPoints: number,
    requestedPoints: number,
    maxBase: number,
    settings: LoyaltySettings
  ): RedeemCheck {
    if (!Number.isInteger(requestedPoints) || requestedPoints <= 0) {
      return { ok: false, reason: "invalid_points" };
    }
    if (settings.pointValue <= 0) {
      return { ok: false, reason: "loyalty_disabled" };
    }
    if (customerPoints < requestedPoints) {
      return { ok: false, reason: "insufficient_points" };
    }
    const discount = LoyaltyPolicy.valueOfPoints(requestedPoints, settings);
    if (discount > Math.max(maxBase, 0)) {
      return { ok: false, reason: "exceeds_total" };
    }
    return { ok: true, discount };
  }
}

export function redeemFailureMessage(reason: RedeemFailureReason): string {
  switch (reason) {
    case "invalid_points":
      return "Jumlah poin tidak valid";
    case "insufficient_points":
      return "Poin pelanggan tidak cukup";
    case "exceeds_total":
      return "Poin melebihi sisa tagihan";
    case "loyalty_disabled":
      return "Penukaran poin belum diaktifkan";
  }
}

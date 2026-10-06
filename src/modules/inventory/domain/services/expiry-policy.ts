// Sub-PRD 4.1 (INV-06): kebijakan peringatan kedaluwarsa.

export const EXPIRY_SETTING_KEYS = {
  expiryWarningDays: "inventory.expiry_warning_days",
} as const;

export const DEFAULT_EXPIRY_WARNING_DAYS = 30;

export type ExpiryStatus = "expired" | "expiring" | "ok";

/**
 * Baca hari peringatan dari record settings (key-value jsonb).
 * Nilai tidak valid / di luar 1..356 jatuh kembali ke default.
 */
export function parseExpiryWarningDays(
  record: Record<string, unknown>
): number {
  const raw = record[EXPIRY_SETTING_KEYS.expiryWarningDays];
  const n =
    typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 365) {
    return DEFAULT_EXPIRY_WARNING_DAYS;
  }
  return Math.floor(n);
}

/**
 * Klasifikasi tanggal kedaluwarsa (format YYYY-MM-DD, perbandingan lexikal
 * aman karena formatnya seragam):
 *   - expired  : sudah lewat tanggal hari ini
 *   - expiring : hari ini s/d hari ini + warningDays (termasuk hari ini)
 *   - ok       : tanpa tanggal / masih lama
 */
export function classifyExpiry(
  expiryDate: string | null | undefined,
  warningDays: number,
  today: string
): ExpiryStatus {
  if (!expiryDate) {
    return "ok";
  }
  if (expiryDate < today) {
    return "expired";
  }
  const limit = addDaysIso(today, warningDays);
  if (expiryDate <= limit) {
    return "expiring";
  }
  return "ok";
}

/** Tambah hari pada string YYYY-MM-DD (UTC, tanpa dependensi waktu lokal). */
export function addDaysIso(isoDate: string, days: number): string {
  const [y = 0, m = 1, d = 1] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

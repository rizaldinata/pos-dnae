import type { Voucher } from "@/modules/promotions/domain/entities/promotion";

export type VoucherFailureReason =
  "not_found" | "inactive" | "expired" | "quota_exhausted" | "min_purchase";

export interface VoucherValidation {
  valid: boolean;
  reason?: VoucherFailureReason;
  discount: number;
}

const MESSAGES: Record<VoucherFailureReason, string> = {
  not_found: "Kode voucher tidak dikenal",
  inactive: "Voucher sudah dinonaktifkan",
  expired: "Voucher sudah kedaluwarsa",
  quota_exhausted: "Kuota voucher habis",
  min_purchase: "Belanja belum mencapai minimum voucher",
};

export function voucherFailureMessage(reason: VoucherFailureReason): string {
  return MESSAGES[reason];
}

export class VoucherValidator {
  public static validate(
    voucher: Voucher | null,
    baseAmount: number,
    now: Date
  ): VoucherValidation {
    if (!voucher) {
      return { valid: false, reason: "not_found", discount: 0 };
    }
    if (!voucher.isActive) {
      return { valid: false, reason: "inactive", discount: 0 };
    }
    if (voucher.expiresAt && voucher.expiresAt.getTime() < now.getTime()) {
      return { valid: false, reason: "expired", discount: 0 };
    }
    if (voucher.remainingQuota <= 0) {
      return { valid: false, reason: "quota_exhausted", discount: 0 };
    }
    if (baseAmount < voucher.minPurchase.amount) {
      return { valid: false, reason: "min_purchase", discount: 0 };
    }
    const discount =
      voucher.type === "percent"
        ? Math.min(
            Math.round((baseAmount * voucher.value.amount) / 100),
            baseAmount
          )
        : Math.min(voucher.value.amount, baseAmount);
    return { valid: true, discount };
  }
}

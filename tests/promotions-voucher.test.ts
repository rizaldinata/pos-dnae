import { describe, expect, it } from "vitest";
import {
  Voucher,
  type VoucherProps,
} from "@/modules/promotions/domain/entities/promotion";
import {
  VoucherValidator,
  voucherFailureMessage,
} from "@/modules/promotions/domain/services/voucher-validator";
import { Money } from "@/shared/lib/money";

const NOW = new Date("2026-10-05T10:00:00Z");

function voucher(overrides: Partial<VoucherProps> = {}): Voucher {
  return Voucher.create(
    {
      code: "hemat50",
      type: "percent",
      value: Money.create(50),
      quota: 10,
      usedCount: 0,
      minPurchase: Money.create(0),
      expiresAt: null,
      isActive: true,
      ...overrides,
    },
    "voucher-1"
  );
}

describe("VoucherValidator", () => {
  it("menolak voucher yang tidak ditemukan", () => {
    const result = VoucherValidator.validate(null, 100000, NOW);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("not_found");
    expect(voucherFailureMessage("not_found")).toBe(
      "Kode voucher tidak dikenal"
    );
  });

  it("menolak voucher yang dinonaktifkan", () => {
    const result = VoucherValidator.validate(
      voucher({ isActive: false }),
      100000,
      NOW
    );
    expect(result.reason).toBe("inactive");
  });

  it("menolak voucher yang sudah kedaluwarsa", () => {
    const result = VoucherValidator.validate(
      voucher({ expiresAt: new Date("2026-10-01T00:00:00Z") }),
      100000,
      NOW
    );
    expect(result.reason).toBe("expired");
  });

  it("menolak voucher yang kuotanya habis", () => {
    const result = VoucherValidator.validate(
      voucher({ quota: 5, usedCount: 5 }),
      100000,
      NOW
    );
    expect(result.reason).toBe("quota_exhausted");
  });

  it("menolak voucher jika belanja di bawah minimum", () => {
    const result = VoucherValidator.validate(
      voucher({ minPurchase: Money.create(200000) }),
      100000,
      NOW
    );
    expect(result.reason).toBe("min_purchase");
  });

  it("menghitung diskon persen dan membatasi maksimal nilai dasar", () => {
    const persen = VoucherValidator.validate(
      voucher({ type: "percent", value: Money.create(10) }),
      50000,
      NOW
    );
    expect(persen).toEqual({ valid: true, discount: 5000 });

    const melebihi = VoucherValidator.validate(
      voucher({ type: "percent", value: Money.create(200) }),
      50000,
      NOW
    );
    expect(melebihi.discount).toBe(50000);
  });

  it("menghitung diskon nominal dan membatasi maksimal nilai dasar", () => {
    const nominal = VoucherValidator.validate(
      voucher({ type: "amount", value: Money.create(20000) }),
      50000,
      NOW
    );
    expect(nominal).toEqual({ valid: true, discount: 20000 });

    const melebihi = VoucherValidator.validate(
      voucher({ type: "amount", value: Money.create(90000) }),
      50000,
      NOW
    );
    expect(melebihi.discount).toBe(50000);
  });

  it("menerima voucher berlaku yang belum terpakai", () => {
    const result = VoucherValidator.validate(
      voucher({ expiresAt: new Date("2026-12-31T00:00:00Z") }),
      100000,
      NOW
    );
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

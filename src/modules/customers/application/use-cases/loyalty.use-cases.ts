import { z } from "zod";
import type { ICustomerRepository } from "@/modules/customers/domain/repositories/customer.repository";
import type { ILoyaltyRepository } from "@/modules/customers/domain/repositories/loyalty.repository";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import type { LoyaltyTransaction } from "@/modules/customers/domain/entities/loyalty";
import {
  DEFAULT_LOYALTY_SETTINGS,
  LoyaltyPolicy,
  parseLoyaltySettings,
  redeemFailureMessage,
  type LoyaltySettings,
} from "@/modules/customers/domain/services/loyalty-policy";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

async function loadLoyaltySettings(
  settings: ISettingsRepository
): Promise<LoyaltySettings> {
  const result = await settings.getAll();
  if (isErr(result)) {
    return { ...DEFAULT_LOYALTY_SETTINGS };
  }
  return parseLoyaltySettings(result.data);
}

export interface LoyaltyPreview {
  customerId: string;
  currentPoints: number;
  earnRatio: number;
  pointValue: number;
  /** Estimasi poin dari nominal transaksi (dibulatkan ke bawah). */
  earnedPoints: number;
}

/**
 * Perolehan poin (CUS-02).
 *
 * Penulisan poin dilakukan atomik di dalam RPC `create_sale` — bersama
 * transaksi, item, pembayaran, dan pengurangan stok — sehingga poin tidak
 * pernah tercatat tanpa transaksi (atau sebaliknya). Use case ini dipakai
 * untuk menampilkan estimasi poin di kasir sebelum pembayaran.
 */
export class EarnPointsUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly settings: ISettingsRepository
  ) {}

  public async execute(input: {
    customerId: string;
    amount: number;
  }): Promise<Result<LoyaltyPreview, DomainError>> {
    const customer = await this.customers.findById(input.customerId);
    if (isErr(customer)) {
      return err(customer.error);
    }
    if (customer.data === null) {
      return err(new NotFoundError("Pelanggan", input.customerId));
    }
    const settings = await loadLoyaltySettings(this.settings);
    return ok({
      customerId: customer.data.id,
      currentPoints: customer.data.points,
      earnRatio: settings.earnRatio,
      pointValue: settings.pointValue,
      earnedPoints: LoyaltyPolicy.pointsForAmount(input.amount, settings),
    });
  }
}

export interface RedeemPreview {
  customerId: string;
  currentPoints: number;
  points: number;
  /** Potongan rupiah dari penukaran; diverifikasi ulang saat checkout. */
  discount: number;
  pointValue: number;
}

/**
 * Penukaran poin sebagai potongan di kasir (POS-14).
 *
 * Hanya validasi & preview: pemotongan saldo poin terjadi atomik di dalam
 * RPC `create_sale` ketika transaksi benar-benar dibuat.
 */
export class RedeemPointsUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly settings: ISettingsRepository
  ) {}

  public async execute(input: {
    customerId: string;
    points: number;
    /** Sisa tagihan maksimal yang boleh dipotong (opsional, untuk preview). */
    maxBase?: number;
  }): Promise<Result<RedeemPreview, DomainError>> {
    if (!input.customerId) {
      return err(new ValidationError("Penukaran poin wajib memilih pelanggan"));
    }
    const customer = await this.customers.findById(input.customerId);
    if (isErr(customer)) {
      return err(customer.error);
    }
    if (customer.data === null) {
      return err(new NotFoundError("Pelanggan", input.customerId));
    }
    const settings = await loadLoyaltySettings(this.settings);
    const check = LoyaltyPolicy.validateRedeem(
      customer.data.points,
      Math.trunc(input.points),
      input.maxBase ?? Number.MAX_SAFE_INTEGER,
      settings
    );
    if (!check.ok) {
      return err(new ValidationError(redeemFailureMessage(check.reason)));
    }
    return ok({
      customerId: customer.data.id,
      currentPoints: customer.data.points,
      points: Math.trunc(input.points),
      discount: check.discount,
      pointValue: settings.pointValue,
    });
  }
}

export const AdjustPointsSchema = z.object({
  points: z
    .number({ error: "Poin harus angka" })
    .int({ error: "Poin harus bilangan bulat" })
    .refine((value) => value !== 0, { error: "Poin tidak boleh 0" })
    .refine((value) => Math.abs(value) <= 1_000_000, {
      error: "Penyesuaian maksimal 1.000.000 poin",
    }),
  note: z
    .string()
    .trim()
    .min(1, { error: "Alasan penyesuaian wajib diisi" })
    .max(300, { error: "Alasan maksimal 300 karakter" }),
});

export type AdjustPointsInput = z.input<typeof AdjustPointsSchema>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/** Penyesuaian poin manual oleh admin (CUS-02), atomic lewat RPC. */
export class AdjustPointsUseCase {
  constructor(
    private readonly loyalty: ILoyaltyRepository,
    private readonly customers: ICustomerRepository
  ) {}

  public async execute(
    customerId: string,
    rawInput: AdjustPointsInput
  ): Promise<Result<LoyaltyTransaction, DomainError>> {
    const parsed = AdjustPointsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data penyesuaian poin tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const customer = await this.customers.findById(customerId);
    if (isErr(customer)) {
      return err(customer.error);
    }
    if (customer.data === null) {
      return err(new NotFoundError("Pelanggan", customerId));
    }
    return this.loyalty.adjust({
      customerId,
      points: parsed.data.points,
      note: parsed.data.note,
    });
  }
}

/** Riwayat poin per pelanggan (earn/redeem/adjust), terbaru di atas. */
export class GetLoyaltyHistoryUseCase {
  constructor(private readonly loyalty: ILoyaltyRepository) {}

  public async execute(
    customerId: string,
    limit?: number
  ): Promise<Result<LoyaltyTransaction[], DomainError>> {
    if (!customerId) {
      return err(new ValidationError("Pelanggan wajib dipilih"));
    }
    return this.loyalty.listByCustomer(customerId, limit);
  }
}

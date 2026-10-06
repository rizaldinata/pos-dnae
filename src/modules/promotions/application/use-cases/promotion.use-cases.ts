import { z } from "zod";
import type {
  IPromotionRepository,
  IVoucherRepository,
} from "@/modules/promotions/domain/repositories/promotion.repository";
import type {
  Promotion,
  Voucher,
} from "@/modules/promotions/domain/entities/promotion";
import {
  VoucherValidator,
  voucherFailureMessage,
} from "@/modules/promotions/domain/services/voucher-validator";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const PromotionSchema = z.object({
  name: z.string().trim().min(1, { error: "Nama promo wajib diisi" }).max(100),
  type: z.enum(["percent", "amount", "bogo"], {
    error: "Tipe promo tidak valid",
  }),
  scope: z.enum(["all", "category", "product"], { error: "Scope tidak valid" }),
  scopeRefId: z.uuid({ error: "ID scope tidak valid" }).nullish(),
  value: z.number().min(0).optional().default(0),
  buyQty: z.number().int().min(0).optional().default(0),
  getQty: z.number().int().min(0).optional().default(0),
  minPurchase: z.number().min(0).optional().default(0),
  startAt: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal harus YYYY-MM-DD" }),
  endAt: z.string().regex(DATE_PATTERN, { error: "Tanggal harus YYYY-MM-DD" }),
  isActive: z.boolean().optional().default(true),
});

export type PromotionInput = z.input<typeof PromotionSchema>;

export const VoucherSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, { error: "Kode minimal 3 karakter" })
    .max(20, { error: "Kode maksimal 20 karakter" })
    .regex(/^[A-Z0-9-]+$/i, { error: "Kode hanya huruf, angka, strip" }),
  type: z.enum(["percent", "amount"], { error: "Tipe voucher tidak valid" }),
  value: z.number().min(0, { error: "Nilai minimal 0" }),
  quota: z.number().int().min(1, { error: "Kuota minimal 1" }),
  minPurchase: z.number().min(0).optional().default(0),
  expiresAt: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal harus YYYY-MM-DD" })
    .nullish(),
});

export type VoucherInput = z.input<typeof VoucherSchema>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

function validatePromotionSemantics(
  type: string,
  scope: string,
  scopeRefId: string | null | undefined,
  value: number,
  buyQty: number,
  getQty: number,
  startAt: string,
  endAt: string
): DomainError | null {
  if ((scope === "category" || scope === "product") && !scopeRefId) {
    return new ValidationError("Scope kategori/produk wajib memilih referensi");
  }
  if (type === "percent" && (value <= 0 || value > 100)) {
    return new ValidationError("Diskon persen harus 1-100");
  }
  if (type === "bogo" && (buyQty <= 0 || getQty <= 0)) {
    return new ValidationError("BOGO wajib mengisi beli & gratis > 0");
  }
  if (startAt > endAt) {
    return new ValidationError("Tanggal mulai tidak boleh setelah selesai");
  }
  return null;
}

export class CreatePromotionUseCase {
  constructor(private readonly promotions: IPromotionRepository) {}

  public async execute(
    rawInput: PromotionInput
  ): Promise<Result<Promotion, DomainError>> {
    const parsed = PromotionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data promo tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const semantic = validatePromotionSemantics(
      parsed.data.type,
      parsed.data.scope,
      parsed.data.scopeRefId,
      parsed.data.value,
      parsed.data.buyQty,
      parsed.data.getQty,
      parsed.data.startAt,
      parsed.data.endAt
    );
    if (semantic) {
      return err(semantic);
    }
    return this.promotions.create({
      name: parsed.data.name,
      type: parsed.data.type,
      scope: parsed.data.scope,
      scopeRefId: parsed.data.scopeRefId ?? null,
      value: Math.round(parsed.data.value),
      buyQty: parsed.data.buyQty,
      getQty: parsed.data.getQty,
      minPurchase: Math.round(parsed.data.minPurchase),
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      isActive: parsed.data.isActive,
    });
  }
}

export class UpdatePromotionUseCase {
  constructor(private readonly promotions: IPromotionRepository) {}

  public async execute(
    id: string,
    rawInput: Partial<PromotionInput> & { isActive?: boolean }
  ): Promise<Result<Promotion, DomainError>> {
    const existing = await this.promotions.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Promo", id));
    }
    const current = existing.data;
    const semantic = validatePromotionSemantics(
      current.type,
      current.scope,
      current.scopeRefId,
      rawInput.value ?? current.value.amount,
      rawInput.buyQty ?? current.buyQty,
      rawInput.getQty ?? current.getQty,
      rawInput.startAt ?? current.startAt.toISOString().slice(0, 10),
      rawInput.endAt ?? current.endAt.toISOString().slice(0, 10)
    );
    if (semantic) {
      return err(semantic);
    }
    return this.promotions.update(id, {
      name: rawInput.name,
      value:
        rawInput.value !== undefined ? Math.round(rawInput.value) : undefined,
      buyQty: rawInput.buyQty,
      getQty: rawInput.getQty,
      minPurchase:
        rawInput.minPurchase !== undefined
          ? Math.round(rawInput.minPurchase)
          : undefined,
      isActive: rawInput.isActive,
    });
  }
}

export class TogglePromotionUseCase {
  constructor(private readonly promotions: IPromotionRepository) {}

  public async execute(
    id: string,
    isActive: boolean
  ): Promise<Result<Promotion, DomainError>> {
    const existing = await this.promotions.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Promo", id));
    }
    return this.promotions.toggleActive(id, isActive);
  }
}

export class ListPromotionsUseCase {
  constructor(private readonly promotions: IPromotionRepository) {}

  public async execute(): Promise<Result<Promotion[], DomainError>> {
    return this.promotions.findAll();
  }
}

export class GetActivePromotionsUseCase {
  constructor(private readonly promotions: IPromotionRepository) {}

  public async execute(): Promise<Result<Promotion[], DomainError>> {
    return this.promotions.findActive(new Date());
  }
}

export class CreateVoucherUseCase {
  constructor(private readonly vouchers: IVoucherRepository) {}

  public async execute(
    rawInput: VoucherInput
  ): Promise<Result<Voucher, DomainError>> {
    const parsed = VoucherSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data voucher tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    if (
      parsed.data.type === "percent" &&
      (parsed.data.value <= 0 || parsed.data.value > 100)
    ) {
      return err(new ValidationError("Voucher persen harus 1-100"));
    }
    const existing = await this.vouchers.findByCode(parsed.data.code);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data !== null) {
      return err(
        new ValidationError(
          `Kode "${parsed.data.code.toUpperCase()}" sudah dipakai`
        )
      );
    }
    return this.vouchers.create({
      code: parsed.data.code,
      type: parsed.data.type,
      value: Math.round(parsed.data.value),
      quota: parsed.data.quota,
      minPurchase: Math.round(parsed.data.minPurchase),
      expiresAt: parsed.data.expiresAt ?? null,
    });
  }
}

export class ListVouchersUseCase {
  constructor(private readonly vouchers: IVoucherRepository) {}

  public async execute(): Promise<Result<Voucher[], DomainError>> {
    return this.vouchers.findAll();
  }
}

export class ToggleVoucherUseCase {
  constructor(private readonly vouchers: IVoucherRepository) {}

  public async execute(
    id: string,
    isActive: boolean
  ): Promise<Result<Voucher, DomainError>> {
    const existing = await this.vouchers.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Voucher", id));
    }
    return this.vouchers.update(id, { isActive });
  }
}

export class ValidateVoucherUseCase {
  constructor(private readonly vouchers: IVoucherRepository) {}

  public async execute(
    code: string,
    baseAmount: number
  ): Promise<
    Result<{ voucherId: string; code: string; discount: number }, DomainError>
  > {
    const found = await this.vouchers.findByCode(code.trim().toUpperCase());
    if (isErr(found)) {
      return err(found.error);
    }
    const validation = VoucherValidator.validate(
      found.data,
      Math.round(baseAmount),
      new Date()
    );
    if (!validation.valid) {
      return err(
        new ValidationError(
          voucherFailureMessage(validation.reason ?? "not_found")
        )
      );
    }
    if (!found.data) {
      return err(new ValidationError("Voucher tidak valid"));
    }
    return ok({
      voucherId: found.data.id,
      code: found.data.code,
      discount: validation.discount,
    });
  }
}

import { z } from "zod";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import type {
  PricingSettings,
  TaxMode,
} from "@/modules/sales/domain/services/tax-calculator";
import { DEFAULT_PRICING_SETTINGS } from "@/modules/sales/domain/services/tax-calculator";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export const PricingSettingsSchema = z.object({
  taxRate: z
    .number({ error: "Pajak harus angka" })
    .min(0, { error: "Pajak minimal 0" })
    .max(100, { error: "Pajak maksimal 100" }),
  taxMode: z.enum(["inclusive", "exclusive"], {
    error: "Mode pajak tidak valid",
  }),
  serviceFeeRate: z
    .number({ error: "Biaya layanan harus angka" })
    .min(0, { error: "Biaya layanan minimal 0" })
    .max(100, { error: "Biaya layanan maksimal 100" }),
});

export type UpdatePricingSettingsInput = z.input<typeof PricingSettingsSchema>;

const TO_KEY: Record<keyof PricingSettings, string> = {
  taxRate: "tax.rate",
  taxMode: "tax.mode",
  serviceFeeRate: "service_fee.rate",
};

function toNumber(value: unknown, fallback: number): number {
  const n =
    typeof value === "string"
      ? Number(value)
      : typeof value === "number"
        ? value
        : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export class GetPricingSettingsUseCase {
  constructor(private readonly settings: ISettingsRepository) {}

  public async execute(): Promise<Result<PricingSettings, DomainError>> {
    const result = await this.settings.getAll();
    if (isErr(result)) {
      return err(result.error);
    }
    const record = result.data;
    const mode = record["tax.mode"];
    return ok({
      taxRate: toNumber(record["tax.rate"], DEFAULT_PRICING_SETTINGS.taxRate),
      taxMode:
        mode === "inclusive" || mode === "exclusive"
          ? (mode as TaxMode)
          : DEFAULT_PRICING_SETTINGS.taxMode,
      serviceFeeRate: toNumber(
        record["service_fee.rate"],
        DEFAULT_PRICING_SETTINGS.serviceFeeRate
      ),
    });
  }
}

export class UpdatePricingSettingsUseCase {
  constructor(private readonly settings: ISettingsRepository) {}

  public async execute(
    rawInput: UpdatePricingSettingsInput
  ): Promise<Result<PricingSettings, DomainError>> {
    const parsed = PricingSettingsSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return err(
        new ValidationError("Pengaturan pajak tidak valid", fieldErrors)
      );
    }
    const entries: Record<string, unknown> = {
      [TO_KEY.taxRate]: parsed.data.taxRate,
      [TO_KEY.taxMode]: parsed.data.taxMode,
      [TO_KEY.serviceFeeRate]: parsed.data.serviceFeeRate,
    };
    const saved = await this.settings.setMany(entries);
    if (isErr(saved)) {
      return err(saved.error);
    }
    return ok(parsed.data);
  }
}

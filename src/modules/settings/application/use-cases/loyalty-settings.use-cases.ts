import { z } from "zod";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import {
  LOYALTY_SETTING_KEYS,
  parseLoyaltySettings,
  type LoyaltySettings,
} from "@/modules/customers/domain/services/loyalty-policy";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export const LoyaltySettingsSchema = z.object({
  earnRatio: z
    .number({ error: "Rasio perolehan harus angka" })
    .min(0, { error: "Rasio perolehan minimal 0" })
    .max(10_000_000, { error: "Rasio perolehan maksimal 10.000.000" }),
  pointValue: z
    .number({ error: "Nilai poin harus angka" })
    .min(0, { error: "Nilai poin minimal 0" })
    .max(1_000_000, { error: "Nilai poin maksimal 1.000.000" }),
});

export type UpdateLoyaltySettingsInput = z.input<typeof LoyaltySettingsSchema>;

export class GetLoyaltySettingsUseCase {
  constructor(private readonly settings: ISettingsRepository) {}

  public async execute(): Promise<Result<LoyaltySettings, DomainError>> {
    const result = await this.settings.getAll();
    if (isErr(result)) {
      return err(result.error);
    }
    return ok(parseLoyaltySettings(result.data));
  }
}

export class UpdateLoyaltySettingsUseCase {
  constructor(private readonly settings: ISettingsRepository) {}

  public async execute(
    rawInput: UpdateLoyaltySettingsInput
  ): Promise<Result<LoyaltySettings, DomainError>> {
    const parsed = LoyaltySettingsSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return err(
        new ValidationError("Pengaturan loyalitas tidak valid", fieldErrors)
      );
    }
    const saved = await this.settings.setMany({
      [LOYALTY_SETTING_KEYS.earnRatio]: parsed.data.earnRatio,
      [LOYALTY_SETTING_KEYS.pointValue]: parsed.data.pointValue,
    });
    if (isErr(saved)) {
      return err(saved.error);
    }
    return ok(parsed.data);
  }
}

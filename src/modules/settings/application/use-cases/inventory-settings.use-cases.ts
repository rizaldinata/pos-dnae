import { z } from "zod";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import {
  EXPIRY_SETTING_KEYS,
  parseExpiryWarningDays,
} from "@/modules/inventory/domain/services/expiry-policy";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export const InventorySettingsSchema = z.object({
  expiryWarningDays: z
    .number({ error: "Hari peringatan harus angka" })
    .min(1, { error: "Hari peringatan minimal 1" })
    .max(365, { error: "Hari peringatan maksimal 365" }),
});

export type UpdateInventorySettingsInput = z.input<
  typeof InventorySettingsSchema
>;

export interface InventorySettings {
  expiryWarningDays: number;
}

export class GetInventorySettingsUseCase {
  constructor(private readonly settings: ISettingsRepository) {}

  public async execute(): Promise<Result<InventorySettings, DomainError>> {
    const result = await this.settings.getAll();
    if (isErr(result)) {
      return err(result.error);
    }
    return ok({ expiryWarningDays: parseExpiryWarningDays(result.data) });
  }
}

export class UpdateInventorySettingsUseCase {
  constructor(private readonly settings: ISettingsRepository) {}

  public async execute(
    rawInput: UpdateInventorySettingsInput
  ): Promise<Result<InventorySettings, DomainError>> {
    const parsed = InventorySettingsSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return err(
        new ValidationError("Pengaturan inventori tidak valid", fieldErrors)
      );
    }
    const saved = await this.settings.setMany({
      [EXPIRY_SETTING_KEYS.expiryWarningDays]: parsed.data.expiryWarningDays,
    });
    if (isErr(saved)) {
      return err(saved.error);
    }
    return ok({ expiryWarningDays: parsed.data.expiryWarningDays });
  }
}

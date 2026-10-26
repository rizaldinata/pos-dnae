import { z } from "zod";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import {
  isStoreSettingKey,
  mapRecordToStoreSettings,
  type StoreSettings,
} from "@/modules/settings/domain/entities/store-setting";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export const StoreSettingsSchema = z.object({
  storeName: z
    .string({ error: "Nama toko wajib diisi" })
    .trim()
    .min(1, { error: "Nama toko wajib diisi" })
    .max(100, { error: "Nama toko maksimal 100 karakter" }),
  storeAddress: z
    .string()
    .trim()
    .max(300, { error: "Alamat maksimal 300 karakter" })
    .optional()
    .default(""),
  storePhone: z
    .string()
    .trim()
    .max(30, { error: "Telepon maksimal 30 karakter" })
    .optional()
    .default(""),
  storeLogoUrl: z
    .string()
    .trim()
    .max(500, { error: "URL logo maksimal 500 karakter" })
    .optional()
    .default(""),
  receiptFooter: z
    .string()
    .trim()
    .max(500, { error: "Footer maksimal 500 karakter" })
    .optional()
    .default(""),
});

export type UpdateStoreSettingsInput = z.input<typeof StoreSettingsSchema>;

// QRIS diatur terpisah (upload gambar, key payment.qris_image_url) sehingga
// tidak ikut dalam form ini.
const TO_KEY: Record<Exclude<keyof StoreSettings, "qrisImageUrl">, string> = {
  storeName: "store.name",
  storeAddress: "store.address",
  storePhone: "store.phone",
  storeLogoUrl: "store.logo_url",
  receiptFooter: "receipt.footer",
};

export class GetStoreSettingsUseCase {
  constructor(private readonly settings: ISettingsRepository) {}

  public async execute(): Promise<Result<StoreSettings, DomainError>> {
    const result = await this.settings.getAll();
    if (isErr(result)) {
      return err(result.error);
    }
    return ok(mapRecordToStoreSettings(result.data));
  }
}

export class UpdateStoreSettingsUseCase {
  constructor(private readonly settings: ISettingsRepository) {}

  public async execute(
    rawInput: UpdateStoreSettingsInput
  ): Promise<Result<StoreSettings, DomainError>> {
    const parsed = StoreSettingsSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return err(
        new ValidationError("Pengaturan toko tidak valid", fieldErrors)
      );
    }

    const entries: Record<string, unknown> = {};
    for (const [field, key] of Object.entries(TO_KEY)) {
      const value = parsed.data[field as keyof typeof parsed.data];
      if (isStoreSettingKey(key)) {
        entries[key] = value;
      }
    }

    const saved = await this.settings.setMany(entries);
    if (isErr(saved)) {
      return err(saved.error);
    }
    return ok(parsed.data as StoreSettings);
  }
}

/**
 * Menyimpan URL gambar QRIS toko (payment.qris_image_url). File diunggah
 * ke bucket store-assets oleh action; use case ini hanya memvalidasi +
 * menyimpan URL publiknya.
 */
export class UpdateQrisImageUseCase {
  constructor(private readonly settings: ISettingsRepository) {}

  public async execute(url: string): Promise<Result<void, DomainError>> {
    const trimmed = url.trim();
    if (!/^https?:\/\/\S{5,500}$/.test(trimmed)) {
      return err(new ValidationError("URL gambar QRIS tidak valid"));
    }
    const saved = await this.settings.set("payment.qris_image_url", trimmed);
    if (isErr(saved)) {
      return err(saved.error);
    }
    return ok(undefined);
  }
}

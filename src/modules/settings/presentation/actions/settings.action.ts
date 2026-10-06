"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import type { StoreSettings } from "@/modules/settings/domain/entities/store-setting";

export interface SettingsActionState {
  success: boolean;
  message: string | null;
  fieldErrors?: Record<string, string[]>;
}

const INITIAL: SettingsActionState = { success: false, message: null };

function toFieldErrors(error: unknown): Record<string, string[]> | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "validationErrors" in error
  ) {
    return (
      (error as { validationErrors?: Record<string, string[]> })
        .validationErrors ?? undefined
    );
  }
  return undefined;
}

export async function getStoreSettingsAction(): Promise<StoreSettings> {
  const container = await getAppContainer();
  const result = await container.settings.getStoreSettings.execute();
  if (isErr(result)) {
    throw new Error(result.error.message);
  }
  return result.data;
}

export async function updateStoreSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const guard = await requirePermission("settings.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  // Pengaturan toko hanya untuk Owner (metode bayar boleh Admin).
  if (guard.user.roleName !== "Owner") {
    return {
      ...INITIAL,
      message: "Hanya Owner yang dapat mengubah pengaturan toko",
    };
  }

  const container = await getAppContainer();
  const result = await container.settings.updateStoreSettings.execute({
    storeName: String(formData.get("storeName") ?? ""),
    storeAddress: String(formData.get("storeAddress") ?? ""),
    storePhone: String(formData.get("storePhone") ?? ""),
    storeLogoUrl: String(formData.get("storeLogoUrl") ?? ""),
    receiptFooter: String(formData.get("receiptFooter") ?? ""),
  });

  if (isErr(result)) {
    return {
      success: false,
      message: result.error.message,
      fieldErrors: toFieldErrors(result.error),
    };
  }

  revalidatePath("/pengaturan/toko");
  return { success: true, message: "Pengaturan toko berhasil disimpan" };
}

export async function uploadStoreLogoAction(
  formData: FormData
): Promise<{ success: boolean; url: string | null; message: string | null }> {
  const guard = await requirePermission("settings.manage");
  if (!guard.ok || guard.user.roleName !== "Owner") {
    return {
      success: false,
      url: null,
      message: "Hanya Owner yang dapat mengunggah logo",
    };
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return {
      success: false,
      url: null,
      message: "Pilih file gambar terlebih dahulu",
    };
  }
  if (!file.type.startsWith("image/")) {
    return { success: false, url: null, message: "File harus berupa gambar" };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { success: false, url: null, message: "Ukuran maksimal 2MB" };
  }

  const { createSupabaseServerClient } =
    await import("@/shared/infrastructure/supabase/server-client");
  const supabase = await createSupabaseServerClient();

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `logo.${ext}`;
  const { error } = await supabase.storage
    .from("store-assets")
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
  if (error) {
    return {
      success: false,
      url: null,
      message: `Gagal mengunggah: ${error.message}`,
    };
  }
  const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
  return {
    success: true,
    url: `${data.publicUrl}?t=${Date.now()}`,
    message: "Logo berhasil diunggah",
  };
}

export interface PricingSettingsState {
  success: boolean;
  message: string | null;
}

export async function updatePricingSettingsAction(
  _prevState: PricingSettingsState,
  formData: FormData
): Promise<PricingSettingsState> {
  const guard = await requirePermission("settings.manage");
  if (!guard.ok || guard.user.roleName !== "Owner") {
    return {
      success: false,
      message: "Hanya Owner yang dapat mengubah pengaturan pajak",
    };
  }
  const container = await getAppContainer();
  const result = await container.settings.updatePricingSettings.execute({
    taxRate: Number(formData.get("taxRate") ?? 0),
    taxMode:
      String(formData.get("taxMode") ?? "exclusive") === "inclusive"
        ? "inclusive"
        : "exclusive",
    serviceFeeRate: Number(formData.get("serviceFee") ?? 0),
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/pengaturan/toko");
  revalidatePath("/kasir");
  return { success: true, message: "Pengaturan pajak & layanan tersimpan" };
}

export async function updateLoyaltySettingsAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const guard = await requirePermission("settings.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.settings.updateLoyaltySettings.execute({
    earnRatio: Number(formData.get("earnRatio") ?? 0),
    pointValue: Number(formData.get("pointValue") ?? 0),
  });
  if (isErr(result)) {
    return {
      ...INITIAL,
      message: result.error.message,
      fieldErrors: toFieldErrors(result.error),
    };
  }
  revalidatePath("/pengaturan/loyalitas");
  revalidatePath("/kasir");
  return { success: true, message: "Pengaturan loyalitas tersimpan" };
}

export async function updateInventorySettingsAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const guard = await requirePermission("settings.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.settings.updateInventorySettings.execute({
    expiryWarningDays: Number(formData.get("expiryWarningDays") ?? 0),
  });
  if (isErr(result)) {
    return {
      ...INITIAL,
      message: result.error.message,
      fieldErrors: toFieldErrors(result.error),
    };
  }
  revalidatePath("/pengaturan/inventori");
  revalidatePath("/stok/kedaluwarsa");
  revalidatePath("/");
  return {
    success: true,
    message: "Pengaturan inventori tersimpan",
  };
}

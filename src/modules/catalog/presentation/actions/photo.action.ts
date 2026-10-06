"use server";

import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server-client";

const MAX_BYTES = 2 * 1024 * 1024;

export async function uploadProductImageAction(
  formData: FormData
): Promise<{ success: boolean; url: string | null; message: string | null }> {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    return { success: false, url: null, message: guard.message };
  }

  const file = formData.get("photo");
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
  if (file.size > MAX_BYTES) {
    return {
      success: false,
      url: null,
      message: "Ukuran maksimal 2MB (kompres dulu di perangkat)",
    };
  }

  const supabase = await createSupabaseServerClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
  if (error) {
    return {
      success: false,
      url: null,
      message: `Gagal mengunggah: ${error.message}`,
    };
  }
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return {
    success: true,
    url: data.publicUrl,
    message: "Foto berhasil diunggah",
  };
}

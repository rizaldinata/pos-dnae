"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";

export interface UsersActionState {
  success: boolean;
  message: string | null;
  fieldErrors?: Record<string, string[]>;
}

function validationFieldErrors(
  error: unknown
): Record<string, string[]> | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "validationErrors" in error
  ) {
    const ve = (error as { validationErrors?: Record<string, string[]> })
      .validationErrors;
    if (ve) {
      return ve;
    }
  }
  return undefined;
}

async function requireUserManager(): Promise<
  { ok: true; actorId: string } | { ok: false; state: UsersActionState }
> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (
    isErr(current) ||
    current.data === null ||
    !current.data.hasPermission("user.manage")
  ) {
    return {
      ok: false,
      state: {
        success: false,
        message: "Anda tidak memiliki akses untuk mengelola pengguna",
      },
    };
  }
  return { ok: true, actorId: current.data.id };
}

export async function createUserAction(
  _prevState: UsersActionState,
  formData: FormData
): Promise<UsersActionState> {
  const guard = await requireUserManager();
  if (!guard.ok) {
    return guard.state;
  }

  const container = await getAppContainer();
  const result = await container.iam.createUser.execute({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    fullName: String(formData.get("fullName") ?? "").trim(),
    roleId: String(formData.get("roleId") ?? ""),
  });

  if (isErr(result)) {
    return {
      success: false,
      message: result.error.message,
      fieldErrors: validationFieldErrors(result.error),
    };
  }

  revalidatePath("/pengaturan/users");
  return {
    success: true,
    message: `Pengguna ${result.data.email} berhasil dibuat`,
  };
}

export async function updateUserAction(
  _prevState: UsersActionState,
  formData: FormData
): Promise<UsersActionState> {
  const guard = await requireUserManager();
  if (!guard.ok) {
    return guard.state;
  }

  const userId = String(formData.get("userId") ?? "");
  const isActiveRaw = formData.get("isActive");
  // Checkbox yang tidak dicentang tidak terkirim browser; bedakan
  // "tidak ada field" (jangan ubah, mis. edit akun sendiri yang disabled)
  // vs "unchecked" (nonaktifkan) lewat penanda isActivePresent.
  const isActivePresent = formData.get("isActivePresent") !== null;

  const container = await getAppContainer();
  const result = await container.iam.updateUser.execute(userId, {
    actorId: guard.actorId,
    fullName: String(formData.get("fullName") ?? "").trim(),
    roleId: String(formData.get("roleId") ?? ""),
    isActive: !isActivePresent
      ? undefined
      : isActiveRaw === "on" || isActiveRaw === "true",
  });

  if (isErr(result)) {
    return {
      success: false,
      message: result.error.message,
      fieldErrors: validationFieldErrors(result.error),
    };
  }

  revalidatePath("/pengaturan/users");
  return {
    success: true,
    message: `Pengguna ${result.data.email} berhasil diperbarui`,
  };
}

import { getAppContainer } from "@/di/container";
import type { User } from "@/modules/iam/domain/entities/user";
import { isErr } from "@/shared/kernel/result";

export type GuardResult =
  { ok: true; user: User } | { ok: false; message: string };

export async function requirePermission(code: string): Promise<GuardResult> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return { ok: false, message: "Sesi berakhir. Silakan masuk kembali." };
  }
  if (!current.data.hasPermission(code)) {
    return { ok: false, message: "Anda tidak memiliki akses untuk aksi ini" };
  }
  return { ok: true, user: current.data };
}

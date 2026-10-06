"use server";

import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface PinUserDTO {
  id: string;
  fullName: string;
  roleName: string;
}

export async function listPinUsersAction(): Promise<PinUserDTO[]> {
  const container = await getAppContainer();
  const result = await container.iam.listPinUsers.execute();
  if (isErr(result)) {
    return [];
  }
  return result.data;
}

export async function loginWithPinAction(
  userId: string,
  pin: string
): Promise<{ success: boolean; message: string | null }> {
  const container = await getAppContainer();
  const result = await container.iam.loginWithPin.execute(userId, pin);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  return { success: true, message: `Selamat datang, ${result.data.fullName}` };
}

export async function setPinAction(
  userId: string,
  pin: string
): Promise<{ success: boolean; message: string | null }> {
  const guard = await requirePermission("user.manage");
  if (!guard.ok) {
    return { success: false, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.iam.setPin.execute(userId, pin);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  return { success: true, message: "PIN berhasil diatur" };
}

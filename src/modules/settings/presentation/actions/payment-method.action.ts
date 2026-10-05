"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface PaymentMethodActionState {
  success: boolean;
  message: string | null;
}

const INITIAL: PaymentMethodActionState = { success: false, message: null };

async function guardSettings(): Promise<null | PaymentMethodActionState> {
  const result = await requirePermission("settings.manage");
  if (!result.ok) {
    return { ...INITIAL, message: result.message };
  }
  return null;
}

function refresh(): void {
  revalidatePath("/pengaturan/pembayaran");
}

export async function createPaymentMethodAction(
  _prevState: PaymentMethodActionState,
  formData: FormData
): Promise<PaymentMethodActionState> {
  const denied = await guardSettings();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.settings.createPaymentMethod.execute({
    name: String(formData.get("name") ?? "").trim(),
    type: String(formData.get("type") ?? "cash") as
      "cash" | "card" | "qris" | "transfer" | "ewallet",
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refresh();
  return {
    success: true,
    message: `Metode "${result.data.name}" berhasil ditambahkan`,
  };
}

export async function updatePaymentMethodAction(
  _prevState: PaymentMethodActionState,
  formData: FormData
): Promise<PaymentMethodActionState> {
  const denied = await guardSettings();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.settings.updatePaymentMethod.execute(
    String(formData.get("paymentMethodId") ?? ""),
    {
      name: String(formData.get("name") ?? "").trim(),
      type: String(formData.get("type") ?? "") as
        "cash" | "card" | "qris" | "transfer" | "ewallet" | undefined,
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refresh();
  return {
    success: true,
    message: `Metode "${result.data.name}" berhasil diperbarui`,
  };
}

export async function togglePaymentMethodAction(
  paymentMethodId: string,
  isActive: boolean
): Promise<PaymentMethodActionState> {
  const denied = await guardSettings();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.settings.updatePaymentMethod.execute(
    paymentMethodId,
    { isActive }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refresh();
  return {
    success: true,
    message: `Metode "${result.data.name}" ${result.data.isActive ? "diaktifkan" : "dinonaktifkan"}`,
  };
}

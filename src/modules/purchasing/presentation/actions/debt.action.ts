"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface DebtActionState {
  success: boolean;
  message: string | null;
}

const INITIAL: DebtActionState = { success: false, message: null };

export async function recordSupplierPaymentAction(
  poId: string,
  amount: number,
  method?: string,
  dueDate?: string | null,
  note?: string
): Promise<DebtActionState & { remaining?: number }> {
  const guard = await requirePermission("purchasing.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.purchasing.recordSupplierPayment.execute(
    poId,
    {
      amount,
      method: method || "Tunai",
      dueDate: dueDate ?? null,
      note: note ?? "",
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/pembelian/hutang");
  return {
    success: true,
    message: `Pembayaran tercatat. Sisa Rp ${result.data.remaining.toLocaleString("id-ID")}`,
    remaining: result.data.remaining,
  };
}

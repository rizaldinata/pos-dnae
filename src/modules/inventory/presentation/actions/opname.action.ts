"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface OpnameActionState {
  success: boolean;
  message: string | null;
}

const INITIAL: OpnameActionState = { success: false, message: null };

export async function adjustStockAction(
  variantId: string,
  newQty: number,
  reason: string
): Promise<OpnameActionState & { oldQty?: number; newQtyResult?: number }> {
  const guard = await requirePermission("stock.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.inventory.adjustStock.execute(variantId, {
    newQty: Math.floor(Number(newQty) || 0),
    reason,
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/stok");
  return {
    success: true,
    message: `Stok disesuaikan ${result.data.oldQty} → ${result.data.newQty}`,
    oldQty: result.data.oldQty,
    newQtyResult: result.data.newQty,
  };
}

export async function createOpnameAction(
  categoryId?: string | null
): Promise<OpnameActionState & { opnameId?: string }> {
  const guard = await requirePermission("stock.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.inventory.createOpname.execute(
    categoryId ?? null
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/stok/opname");
  return {
    success: true,
    message: `Sesi ${result.data.opname.code} dibuat`,
    opnameId: result.data.opname.id,
  };
}

export async function updateOpnameItemAction(
  opnameId: string,
  variantId: string,
  actualQty: number
): Promise<OpnameActionState> {
  const guard = await requirePermission("stock.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.inventory.updateOpnameItem.execute(
    opnameId,
    variantId,
    {
      actualQty: Math.floor(Number(actualQty) || 0),
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath(`/stok/opname/${opnameId}`);
  return { success: true, message: "Stok fisik tersimpan" };
}

export async function approveOpnameAction(
  opnameId: string
): Promise<OpnameActionState> {
  const guard = await requirePermission("opname.approve");
  if (!guard.ok) {
    return {
      ...INITIAL,
      message: "Approve opname butuh persetujuan manajer ke atas",
    };
  }
  const container = await getAppContainer();
  const result = await container.inventory.approveOpname.execute(opnameId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath(`/stok/opname/${opnameId}`);
  revalidatePath("/stok");
  revalidatePath("/laporan/shift");
  return {
    success: true,
    message: `Opname disetujui. ${result.data.adjustedItems} varian disesuaikan.`,
  };
}

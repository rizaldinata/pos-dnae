"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface SupplierDTO {
  id: string;
  name: string;
  phone: string;
  address: string;
  paymentTermsDays: number;
}

export interface PurchasingActionState {
  success: boolean;
  message: string | null;
}

const INITIAL: PurchasingActionState = { success: false, message: null };

async function guardPurchasing(): Promise<null | PurchasingActionState> {
  const result = await requirePermission("purchasing.manage");
  if (!result.ok) {
    return { ...INITIAL, message: result.message };
  }
  return null;
}

function refreshPO(poId?: string): void {
  revalidatePath("/pembelian/po");
  revalidatePath("/pembelian/supplier");
  revalidatePath("/pembelian/retur");
  if (poId) {
    revalidatePath(`/pembelian/po/${poId}`);
  }
}

export async function listSuppliersAction(): Promise<SupplierDTO[]> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return [];
  }
  const result = await container.purchasing.listSuppliers.execute();
  if (isErr(result)) {
    return [];
  }
  return result.data.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    address: s.address,
    paymentTermsDays: s.paymentTermsDays,
  }));
}

export async function createSupplierAction(
  _prevState: PurchasingActionState,
  formData: FormData
): Promise<PurchasingActionState> {
  const denied = await guardPurchasing();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.purchasing.createSupplier.execute({
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    paymentTermsDays: Math.max(
      Number(formData.get("paymentTermsDays") ?? 0) || 0,
      0
    ),
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshPO();
  return {
    success: true,
    message: `Supplier "${result.data.name}" berhasil ditambahkan`,
  };
}

export async function updateSupplierAction(
  _prevState: PurchasingActionState,
  formData: FormData
): Promise<PurchasingActionState> {
  const denied = await guardPurchasing();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.purchasing.updateSupplier.execute(
    String(formData.get("supplierId") ?? ""),
    {
      name: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      paymentTermsDays: Math.max(
        Number(formData.get("paymentTermsDays") ?? 0) || 0,
        0
      ),
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshPO();
  return {
    success: true,
    message: `Supplier "${result.data.name}" berhasil diperbarui`,
  };
}

export async function deleteSupplierAction(
  supplierId: string
): Promise<PurchasingActionState> {
  const denied = await guardPurchasing();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.purchasing.deleteSupplier.execute(supplierId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshPO();
  return { success: true, message: "Supplier berhasil dihapus" };
}

export interface POItemFormInput {
  variantId: string;
  qty: number;
  costPrice: number;
}

export async function createPOAction(input: {
  supplierId: string;
  notes?: string;
  items: POItemFormInput[];
}): Promise<PurchasingActionState & { poId?: string }> {
  const denied = await guardPurchasing();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.purchasing.createPO.execute({
    supplierId: input.supplierId,
    notes: input.notes ?? "",
    items: input.items,
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshPO(result.data.poId);
  return {
    success: true,
    message: `PO ${result.data.poNo} dibuat`,
    poId: result.data.poId,
  };
}

export async function sendPOAction(
  poId: string
): Promise<PurchasingActionState> {
  const denied = await guardPurchasing();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.purchasing.sendPO.execute(poId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshPO(poId);
  return {
    success: true,
    message: `PO ${result.data.poNo} dikirim ke supplier`,
  };
}

export async function cancelPOAction(
  poId: string
): Promise<PurchasingActionState> {
  const denied = await guardPurchasing();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.purchasing.cancelPO.execute(poId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshPO(poId);
  return { success: true, message: `PO ${result.data.poNo} dibatalkan` };
}

export async function receiveGoodsAction(input: {
  poId: string;
  items: {
    variantId: string;
    qty: number;
    costPrice: number;
    batchNo?: string;
    expiryDate?: string | null;
  }[];
  note?: string;
}): Promise<PurchasingActionState> {
  const denied = await guardPurchasing();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.purchasing.receiveGoods.execute(input.poId, {
    items: input.items,
    note: input.note ?? "",
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshPO(input.poId);
  revalidatePath("/stok");
  revalidatePath("/produk");
  return { success: true, message: `Barang diterima (${result.data.grNo})` };
}

export async function createPurchaseReturnAction(input: {
  supplierId: string;
  reason: string;
  items: { variantId: string; qty: number; costPrice: number }[];
}): Promise<PurchasingActionState> {
  const denied = await guardPurchasing();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.purchasing.createPurchaseReturn.execute(
    input.supplierId,
    {
      reason: input.reason,
      items: input.items,
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshPO();
  revalidatePath("/stok");
  return {
    success: true,
    message: `Retur ${result.data.returnNo} tercatat (Rp ${result.data.totalRefund.amount.toLocaleString("id-ID")})`,
  };
}

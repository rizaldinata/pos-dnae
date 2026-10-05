"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface VoidReturnActionState {
  success: boolean;
  message: string | null;
}

const INITIAL: VoidReturnActionState = { success: false, message: null };

export async function voidSaleAction(
  saleId: string,
  reason: string
): Promise<VoidReturnActionState> {
  const guard = await requirePermission("sale.void");
  if (!guard.ok) {
    // Kasir tanpa hak: butuh approval manajer (PIN menyusul di 2.7).
    return { ...INITIAL, message: "Void butuh persetujuan manajer" };
  }
  const container = await getAppContainer();
  const result = await container.sales.voidSale.execute(
    { userId: guard.user.id, canVoid: true },
    saleId,
    { reason }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath(`/laporan/transaksi/${saleId}`);
  revalidatePath("/laporan/penjualan");
  revalidatePath("/stok");
  return {
    success: true,
    message: `Transaksi ${result.data.sale.invoiceNo} di-void`,
  };
}

export async function createReturnAction(
  saleId: string,
  items: { saleItemId: string; qty: number }[],
  refundMethodId: string,
  reason: string
): Promise<VoidReturnActionState & { totalRefund?: number }> {
  const guard = await requirePermission("sale.return");
  if (!guard.ok) {
    return { ...INITIAL, message: "Retur butuh persetujuan manajer" };
  }
  const container = await getAppContainer();
  const result = await container.sales.createReturn.execute(
    { userId: guard.user.id, canReturn: true },
    saleId,
    { items, refundMethodId, reason }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath(`/laporan/transaksi/${saleId}`);
  revalidatePath("/laporan/penjualan");
  revalidatePath("/laporan/retur");
  revalidatePath("/stok");
  return {
    success: true,
    message: `Retur berhasil. Total refund Rp ${result.data.totalRefund.toLocaleString("id-ID")}`,
    totalRefund: result.data.totalRefund,
  };
}

export interface ReturnHistoryItem {
  id: string;
  saleId: string;
  invoiceNo: string;
  reason: string;
  totalRefund: number;
  refundMethodName: string;
  createdAt: string;
}

export async function listReturnsAction(
  page: number
): Promise<{
  items: ReturnHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (
    isErr(current) ||
    current.data === null ||
    !current.data.hasPermission("report.view")
  ) {
    return { items: [], total: 0, page, pageSize: 20 };
  }
  const result = await container.sales.listReturns.execute({
    page,
    pageSize: 20,
  });
  if (isErr(result)) {
    return { items: [], total: 0, page, pageSize: 20 };
  }
  return {
    items: result.data.items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      invoiceNo: item.invoiceNo,
      reason: item.reason,
      totalRefund: item.totalRefund.amount,
      refundMethodName: item.refundMethodName,
      createdAt: item.createdAt.toISOString(),
    })),
    total: result.data.total,
    page: result.data.page,
    pageSize: result.data.pageSize,
  };
}

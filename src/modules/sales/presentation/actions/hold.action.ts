"use server";

import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface HoldSaleItemInput {
  variantId: string;
  qty: number;
  discount: number;
}

export interface HeldSaleDTO {
  saleId: string;
  holdNo: string;
  customerId: string | null;
  itemCount: number;
  totalQty: number;
  grandTotal: number;
  createdAt: string;
}

export interface ResumeItemDTO {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  barcode: string | null;
  qty: number;
  discount: number;
  sellPrice: number;
  costPrice: number;
  stockQty: number;
  trackStock: boolean;
  tiers: { minQty: number; price: number }[];
}

export interface ResumeDTO {
  saleId: string;
  holdNo: string;
  customerId: string | null;
  discountTotal: number;
  items: ResumeItemDTO[];
}

export async function holdCurrentCartAction(input: {
  items: HoldSaleItemInput[];
  customerId?: string | null;
  discountTotal?: number;
  transactionDiscount?: number;
  taxTotal?: number;
  serviceFee?: number;
}): Promise<{ success: boolean; message: string | null; holdNo?: string }> {
  const guard = await requirePermission("sale.create");
  if (!guard.ok) {
    return { success: false, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.sales.holdSale.execute(guard.user.id, {
    items: input.items,
    customerId: input.customerId ?? null,
    discountTotal: input.discountTotal ?? 0,
    transactionDiscount: input.transactionDiscount ?? 0,
    taxTotal: input.taxTotal ?? 0,
    serviceFee: input.serviceFee ?? 0,
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  return {
    success: true,
    message: `Transaksi ${result.data.holdNo} di-hold`,
    holdNo: result.data.holdNo,
  };
}

export async function listHeldSalesAction(): Promise<HeldSaleDTO[]> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return [];
  }
  const result = await container.sales.listHeldSales.execute(current.data.id);
  if (isErr(result)) {
    return [];
  }
  return result.data.map((h) => ({
    saleId: h.saleId,
    holdNo: h.holdNo,
    customerId: h.customerId,
    itemCount: h.itemCount,
    totalQty: h.totalQty,
    grandTotal: h.grandTotal,
    createdAt: h.createdAt.toISOString(),
  }));
}

export async function resumeHeldSaleAction(
  saleId: string
): Promise<
  { success: true; resume: ResumeDTO } | { success: false; message: string }
> {
  const guard = await requirePermission("sale.create");
  if (!guard.ok) {
    return { success: false, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.sales.resumeSale.execute(saleId, false);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  const resume = result.data;
  return {
    success: true,
    resume: {
      saleId: resume.saleId,
      holdNo: resume.holdNo,
      customerId: resume.customerId,
      discountTotal: resume.discountTotal,
      items: resume.items.map((item) => ({
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        barcode: item.barcode,
        qty: item.qty,
        discount: item.discount,
        sellPrice: item.sellPrice,
        costPrice: item.costPrice,
        stockQty: item.stockQty,
        trackStock: item.trackStock,
        tiers: item.tiers,
      })),
    },
  };
}

export async function cancelHeldSaleAction(
  saleId: string
): Promise<{ success: boolean; message: string | null }> {
  const guard = await requirePermission("sale.create");
  if (!guard.ok) {
    return { success: false, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.sales.resumeSale.execute(saleId, true);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  return { success: true, message: "Hold dibatalkan" };
}

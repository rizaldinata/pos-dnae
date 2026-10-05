"use server";

import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface PriceTierDTO {
  minQty: number;
  price: number;
}

export async function getPriceTiersAction(
  variantId: string
): Promise<{
  success: boolean;
  tiers: PriceTierDTO[];
  message: string | null;
}> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return { success: false, tiers: [], message: "Sesi berakhir" };
  }
  const result = await container.catalog.getPriceTiers.execute(variantId);
  if (isErr(result)) {
    return { success: false, tiers: [], message: result.error.message };
  }
  return {
    success: true,
    tiers: result.data.map((t) => ({
      minQty: t.minQty,
      price: t.price.amount,
    })),
    message: null,
  };
}

export async function setPriceTiersAction(
  variantId: string,
  tiers: PriceTierDTO[]
): Promise<{ success: boolean; message: string | null }> {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    return { success: false, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.catalog.setPriceTiers.execute(variantId, {
    tiers: tiers.map((t) => ({
      minQty: Math.floor(t.minQty),
      price: Math.round(t.price),
    })),
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  return { success: true, message: "Harga grosir tersimpan" };
}

export async function getPricingSettingsAction(): Promise<{
  taxRate: number;
  taxMode: "inclusive" | "exclusive";
  serviceFeeRate: number;
}> {
  const container = await getAppContainer();
  const result = await container.settings.getPricingSettings.execute();
  if (isErr(result)) {
    return { taxRate: 0, taxMode: "exclusive", serviceFeeRate: 0 };
  }
  return result.data;
}

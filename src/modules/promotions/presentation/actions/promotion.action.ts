"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface PromotionDTO {
  id: string;
  name: string;
  type: "percent" | "amount" | "bogo";
  scope: "all" | "category" | "product";
  scopeRefId: string | null;
  value: number;
  buyQty: number;
  getQty: number;
  minPurchase: number;
  startAt: string;
  endAt: string;
  isActive: boolean;
}

export interface VoucherDTO {
  id: string;
  code: string;
  type: "percent" | "amount";
  value: number;
  quota: number;
  usedCount: number;
  remainingQuota: number;
  minPurchase: number;
  expiresAt: string | null;
  isActive: boolean;
}

export interface PromotionActionState {
  success: boolean;
  message: string | null;
}

export interface VoucherApplyResult {
  success: boolean;
  message: string | null;
  voucher: { code: string; discount: number } | null;
}

const INITIAL: PromotionActionState = { success: false, message: null };

function toPromotionDTO(promotion: {
  id: string;
  name: string;
  type: "percent" | "amount" | "bogo";
  scope: "all" | "category" | "product";
  scopeRefId: string | null;
  value: { amount: number };
  buyQty: number;
  getQty: number;
  minPurchase: { amount: number };
  startAt: Date;
  endAt: Date;
  isActive: boolean;
}): PromotionDTO {
  return {
    id: promotion.id,
    name: promotion.name,
    type: promotion.type,
    scope: promotion.scope,
    scopeRefId: promotion.scopeRefId,
    value: promotion.value.amount,
    buyQty: promotion.buyQty,
    getQty: promotion.getQty,
    minPurchase: promotion.minPurchase.amount,
    startAt: promotion.startAt.toISOString(),
    endAt: promotion.endAt.toISOString(),
    isActive: promotion.isActive,
  };
}

function numberOrZero(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: FormDataEntryValue | null, fallback: string): string {
  const raw = String(value ?? "").trim();
  return raw.length === 10 ? raw : fallback;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function guardPromo(): Promise<PromotionActionState | null> {
  const result = await requirePermission("promo.manage");
  if (!result.ok) {
    return { ...INITIAL, message: result.message };
  }
  return null;
}

export async function createPromotionAction(
  _prevState: PromotionActionState,
  formData: FormData
): Promise<PromotionActionState> {
  const denied = await guardPromo();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const today = isoDate(new Date());
  const result = await container.promotions.createPromotion.execute({
    name: String(formData.get("name") ?? "").trim(),
    type: String(formData.get("type") ?? "percent") as
      "percent" | "amount" | "bogo",
    scope: String(formData.get("scope") ?? "all") as
      "all" | "category" | "product",
    scopeRefId: String(formData.get("scopeRefId") ?? "").trim() || null,
    value: numberOrZero(formData.get("value")),
    buyQty: numberOrZero(formData.get("buyQty")),
    getQty: numberOrZero(formData.get("getQty")),
    minPurchase: numberOrZero(formData.get("minPurchase")),
    startAt: dateValue(formData.get("startAt"), today),
    endAt: dateValue(formData.get("endAt"), today),
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/promo");
  return {
    success: true,
    message: `Promo "${result.data.name}" berhasil dibuat`,
  };
}

export async function updatePromotionAction(
  _prevState: PromotionActionState,
  formData: FormData
): Promise<PromotionActionState> {
  const denied = await guardPromo();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const today = isoDate(new Date());
  const result = await container.promotions.updatePromotion.execute(
    String(formData.get("promotionId") ?? ""),
    {
      name: String(formData.get("name") ?? "").trim(),
      value: numberOrZero(formData.get("value")),
      buyQty: numberOrZero(formData.get("buyQty")),
      getQty: numberOrZero(formData.get("getQty")),
      minPurchase: numberOrZero(formData.get("minPurchase")),
      startAt: dateValue(formData.get("startAt"), today),
      endAt: dateValue(formData.get("endAt"), today),
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/promo");
  return {
    success: true,
    message: `Promo "${result.data.name}" berhasil diperbarui`,
  };
}

export async function togglePromotionAction(
  promotionId: string,
  isActive: boolean
): Promise<PromotionActionState> {
  const denied = await guardPromo();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.promotions.togglePromotion.execute(
    promotionId,
    isActive
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/promo");
  return {
    success: true,
    message: `Promo "${result.data.name}" ${isActive ? "diaktifkan" : "dinonaktifkan"}`,
  };
}

export async function createVoucherAction(
  _prevState: PromotionActionState,
  formData: FormData
): Promise<PromotionActionState> {
  const denied = await guardPromo();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();
  const result = await container.promotions.createVoucher.execute({
    code: String(formData.get("code") ?? "").trim(),
    type: String(formData.get("type") ?? "percent") as "percent" | "amount",
    value: numberOrZero(formData.get("value")),
    quota: numberOrZero(formData.get("quota")) || 1,
    minPurchase: numberOrZero(formData.get("minPurchase")),
    expiresAt: expiresRaw.length === 10 ? expiresRaw : null,
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/promo/voucher");
  return {
    success: true,
    message: `Voucher "${result.data.code}" berhasil dibuat`,
  };
}

export async function toggleVoucherAction(
  voucherId: string,
  isActive: boolean
): Promise<PromotionActionState> {
  const denied = await guardPromo();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.promotions.toggleVoucher.execute(
    voucherId,
    isActive
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/promo/voucher");
  return {
    success: true,
    message: `Voucher "${result.data.code}" ${isActive ? "diaktifkan" : "dinonaktifkan"}`,
  };
}

/** Promo aktif untuk layar kasir (semua role yang bisa bertransaksi). */
export async function getActivePromotionsAction(): Promise<PromotionDTO[]> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return [];
  }
  const result = await container.promotions.getActivePromotions.execute();
  if (isErr(result)) {
    return [];
  }
  return result.data.map(toPromotionDTO);
}

/** Validasi & hitung voucher untuk keranjang kasir (POS-13). */
export async function validateVoucherAction(
  code: string,
  baseAmount: number
): Promise<VoucherApplyResult> {
  const guard = await requirePermission("sale.create");
  if (!guard.ok) {
    return { success: false, message: guard.message, voucher: null };
  }
  const container = await getAppContainer();
  const result = await container.promotions.validateVoucher.execute(
    code,
    baseAmount
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message, voucher: null };
  }
  return {
    success: true,
    message: `Voucher ${result.data.code} diterapkan`,
    voucher: { code: result.data.code, discount: result.data.discount },
  };
}

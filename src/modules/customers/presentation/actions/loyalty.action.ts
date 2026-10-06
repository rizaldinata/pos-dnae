"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface LoyaltyActionState {
  success: boolean;
  message: string | null;
}

const INITIAL: LoyaltyActionState = { success: false, message: null };

export interface LoyaltyPreviewDTO {
  customerId: string;
  currentPoints: number;
  earnRatio: number;
  pointValue: number;
  /** Estimasi poin yang didapat dari nominal transaksi (server menghitung ulang saat checkout). */
  earnedPoints: number;
}

export async function getLoyaltyPreviewAction(
  customerId: string,
  amount: number
): Promise<LoyaltyPreviewDTO | null> {
  const guard = await requirePermission("sale.create");
  if (!guard.ok) {
    return null;
  }
  const container = await getAppContainer();
  const result = await container.customers.earnPoints.execute({
    customerId,
    amount,
  });
  if (isErr(result)) {
    return null;
  }
  return {
    customerId: result.data.customerId,
    currentPoints: result.data.currentPoints,
    earnRatio: result.data.earnRatio,
    pointValue: result.data.pointValue,
    earnedPoints: result.data.earnedPoints,
  };
}

export interface RedeemActionState extends LoyaltyActionState {
  redeem?: {
    customerId: string;
    currentPoints: number;
    points: number;
    discount: number;
    pointValue: number;
  };
}

/** Preview penukaran poin di kasir (POS-14); checkout memvalidasi ulang. */
export async function previewRedeemAction(
  customerId: string,
  points: number
): Promise<RedeemActionState> {
  const guard = await requirePermission("sale.create");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.customers.redeemPoints.execute({
    customerId,
    points,
  });
  if (isErr(result)) {
    return { ...INITIAL, message: result.error.message };
  }
  return {
    success: true,
    message: null,
    redeem: {
      customerId: result.data.customerId,
      currentPoints: result.data.currentPoints,
      points: result.data.points,
      discount: result.data.discount,
      pointValue: result.data.pointValue,
    },
  };
}

/** Penyesuaian poin manual oleh admin (CUS-02). */
export async function adjustPointsAction(input: {
  customerId: string;
  points: number;
  note: string;
}): Promise<LoyaltyActionState> {
  const guard = await requirePermission("customer.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.customers.adjustPoints.execute(
    input.customerId,
    { points: input.points, note: input.note }
  );
  if (isErr(result)) {
    return { ...INITIAL, message: result.error.message };
  }
  revalidatePath(`/pelanggan/${input.customerId}`);
  revalidatePath("/pelanggan");
  return {
    success: true,
    message: `Poin disesuaikan (${result.data.points > 0 ? "+" : ""}${result.data.points})`,
  };
}

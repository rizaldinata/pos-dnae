"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface ShiftDTO {
  id: string;
  userId: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  expectedCash: number | null;
  closingCash: number | null;
  difference: number | null;
  status: "open" | "closed";
}

export interface ShiftSummaryDTO {
  shift: ShiftDTO;
  transactions: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  changeGiven: number;
  refundsCash: number;
  expectedCash: number;
  closingCash: number | null;
  difference: number | null;
  byMethod: {
    methodName: string;
    methodType: string;
    transactions: number;
    total: number;
  }[];
}

export interface ShiftActionState {
  success: boolean;
  message: string | null;
  shift?: ShiftDTO | null;
  summary?: ShiftSummaryDTO | null;
}

const INITIAL: ShiftActionState = { success: false, message: null };

function toDTO(shift: {
  id: string;
  userId: string;
  openedAt: Date;
  closedAt: Date | null;
  openingCash: { amount: number };
  expectedCash: { amount: number } | null;
  closingCash: { amount: number } | null;
  difference: { amount: number } | null;
  status: "open" | "closed";
}): ShiftDTO {
  return {
    id: shift.id,
    userId: shift.userId,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt?.toISOString() ?? null,
    openingCash: shift.openingCash.amount,
    expectedCash: shift.expectedCash?.amount ?? null,
    closingCash: shift.closingCash?.amount ?? null,
    difference: shift.difference?.amount ?? null,
    status: shift.status,
  };
}

function toSummaryDTO(summary: {
  shift: Parameters<typeof toDTO>[0];
  transactions: number;
  cashSales: { amount: number };
  cashIn: { amount: number };
  cashOut: { amount: number };
  changeGiven: { amount: number };
  refundsCash: { amount: number };
  expectedCash: { amount: number };
  closingCash: { amount: number } | null;
  difference: { amount: number } | null;
  byMethod: {
    methodName: string;
    methodType: string;
    transactions: number;
    total: { amount: number };
  }[];
}): ShiftSummaryDTO {
  return {
    shift: toDTO(summary.shift),
    transactions: summary.transactions,
    cashSales: summary.cashSales.amount,
    cashIn: summary.cashIn.amount,
    cashOut: summary.cashOut.amount,
    changeGiven: summary.changeGiven.amount,
    refundsCash: summary.refundsCash.amount,
    expectedCash: summary.expectedCash.amount,
    closingCash: summary.closingCash?.amount ?? null,
    difference: summary.difference?.amount ?? null,
    byMethod: summary.byMethod.map((m) => ({
      methodName: m.methodName,
      methodType: m.methodType,
      transactions: m.transactions,
      total: m.total.amount,
    })),
  };
}

async function requireCashier(): Promise<
  { ok: true; userId: string } | { ok: false; state: ShiftActionState }
> {
  const guard = await requirePermission("sale.create");
  if (!guard.ok) {
    return { ok: false, state: { ...INITIAL, message: guard.message } };
  }
  return { ok: true, userId: guard.user.id };
}

export async function getCurrentShiftAction(): Promise<ShiftDTO | null> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return null;
  }
  const result = await container.shifts.getCurrentShift.execute(
    current.data.id
  );
  if (isErr(result) || result.data === null) {
    return null;
  }
  return toDTO(result.data);
}

export async function openShiftAction(
  openingCash: number
): Promise<ShiftActionState> {
  const guard = await requireCashier();
  if (!guard.ok) {
    return guard.state;
  }
  const container = await getAppContainer();
  const result = await container.shifts.openShift.execute(guard.userId, {
    openingCash,
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/kasir");
  return { success: true, message: "Shift dibuka", shift: toDTO(result.data) };
}

export async function closeShiftAction(
  shiftId: string,
  closingCash: number,
  note?: string
): Promise<ShiftActionState> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return { ...INITIAL, message: "Sesi berakhir. Silakan masuk kembali." };
  }
  const result = await container.shifts.closeShift.execute(
    {
      userId: current.data.id,
      canManageAll: current.data.hasPermission("shift.manage"),
    },
    shiftId,
    { closingCash, note }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/kasir");
  revalidatePath("/laporan/shift");
  return {
    success: true,
    message: "Shift ditutup",
    summary: toSummaryDTO(result.data),
  };
}

export async function addCashMovementAction(
  shiftId: string,
  type: "in" | "out",
  amount: number,
  note?: string
): Promise<ShiftActionState> {
  const guard = await requireCashier();
  if (!guard.ok) {
    return guard.state;
  }
  const container = await getAppContainer();
  const result = await container.shifts.addCashMovement.execute(
    { userId: guard.userId },
    shiftId,
    { type, amount, note }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/kasir");
  return {
    success: true,
    message: type === "in" ? "Kas masuk tercatat" : "Kas keluar tercatat",
  };
}

export async function getShiftSummaryAction(
  shiftId: string
): Promise<ShiftSummaryDTO | null> {
  const container = await getAppContainer();
  const result = await container.shifts.getShiftSummary.execute(shiftId);
  if (isErr(result)) {
    return null;
  }
  return toSummaryDTO(result.data);
}

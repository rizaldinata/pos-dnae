"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface ExpenseActionState {
  success: boolean;
  message: string | null;
}

const INITIAL: ExpenseActionState = { success: false, message: null };

function numberValue(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function textValue(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export async function recordExpenseAction(
  _prevState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const guard = await requirePermission("finance.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.finance.recordExpense.execute(guard.user.id, {
    categoryId: textValue(formData.get("categoryId")),
    amount: numberValue(formData.get("amount")),
    note: textValue(formData.get("note")),
    expenseDate: textValue(formData.get("expenseDate")),
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/keuangan/pengeluaran");
  return { success: true, message: "Pengeluaran berhasil dicatat" };
}

export async function updateExpenseAction(
  _prevState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const guard = await requirePermission("finance.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.finance.updateExpense.execute(
    textValue(formData.get("expenseId")),
    {
      categoryId: textValue(formData.get("categoryId")),
      amount: numberValue(formData.get("amount")),
      note: textValue(formData.get("note")),
      expenseDate: textValue(formData.get("expenseDate")),
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/keuangan/pengeluaran");
  return { success: true, message: "Pengeluaran berhasil diperbarui" };
}

export async function deleteExpenseAction(
  expenseId: string
): Promise<ExpenseActionState> {
  const guard = await requirePermission("finance.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.finance.deleteExpense.execute(expenseId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/keuangan/pengeluaran");
  return { success: true, message: "Pengeluaran berhasil dihapus" };
}

export async function createExpenseCategoryAction(
  _prevState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const guard = await requirePermission("finance.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.finance.createExpenseCategory.execute({
    name: textValue(formData.get("name")),
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/keuangan/pengeluaran");
  return {
    success: true,
    message: `Kategori "${result.data.name}" berhasil dibuat`,
  };
}

export async function updateExpenseCategoryAction(
  _prevState: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const guard = await requirePermission("finance.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.finance.updateExpenseCategory.execute(
    textValue(formData.get("categoryId")),
    { name: textValue(formData.get("name")) }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/keuangan/pengeluaran");
  return {
    success: true,
    message: `Kategori "${result.data.name}" berhasil diperbarui`,
  };
}

export async function deleteExpenseCategoryAction(
  categoryId: string
): Promise<ExpenseActionState> {
  const guard = await requirePermission("finance.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result =
    await container.finance.deleteExpenseCategory.execute(categoryId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/keuangan/pengeluaran");
  return { success: true, message: "Kategori berhasil dihapus" };
}

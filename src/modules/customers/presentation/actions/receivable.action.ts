"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";

export interface ReceivableActionState {
  success: boolean;
  message: string | null;
}

const INITIAL: ReceivableActionState = { success: false, message: null };

export interface ReceivableCustomerDTO {
  customerId: string;
  customerName: string;
  phone: string;
  balance: number;
  lastSaleAt: string | null;
}

export async function listReceivablesAction(
  query?: string
): Promise<ReceivableCustomerDTO[]> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return [];
  }
  const result = await container.customers.listReceivables.execute(query);
  if (isErr(result)) {
    return [];
  }
  return result.data.map((r) => ({
    customerId: r.customerId,
    customerName: r.customerName,
    phone: r.phone,
    balance: r.balance.amount,
    lastSaleAt: r.lastSaleAt?.toISOString() ?? null,
  }));
}

export async function recordReceivablePaymentAction(input: {
  customerId: string;
  saleId?: string | null;
  amount: number;
  paymentMethodId?: string | null;
  note?: string;
}): Promise<ReceivableActionState & { newBalance?: number }> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return { ...INITIAL, message: "Sesi berakhir" };
  }
  const result = await container.customers.recordReceivablePayment.execute(
    input.customerId,
    {
      amount: input.amount,
      saleId: input.saleId ?? null,
      paymentMethodId: input.paymentMethodId ?? null,
      note: input.note ?? "",
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/pelanggan/piutang");
  revalidatePath(`/pelanggan/${input.customerId}`);
  return {
    success: true,
    message: `Pembayaran tercatat. Sisa Rp ${result.data.newBalance.toLocaleString("id-ID")}`,
    newBalance: result.data.newBalance,
  };
}

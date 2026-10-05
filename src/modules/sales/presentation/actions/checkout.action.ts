"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface ReceiptItemDTO {
  productName: string;
  sku: string;
  qty: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface ReceiptPaymentDTO {
  paymentMethodName: string;
  paymentMethodType: string;
  amount: number;
  referenceNo: string | null;
}

export interface ReceiptDTO {
  saleId: string;
  invoiceNo: string;
  createdAt: string;
  cashierName: string;
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  paidTotal: number;
  changeAmount: number;
  items: ReceiptItemDTO[];
  payments: ReceiptPaymentDTO[];
}

export interface CheckoutActionState {
  success: boolean;
  message: string | null;
  receipt: ReceiptDTO | null;
}

export interface CheckoutFormInput {
  items: {
    variantId: string;
    qty: number;
    discount?: { kind: "percent" | "amount"; value: number };
  }[];
  customerId?: string | null;
  transactionDiscount?: { kind: "percent" | "amount"; value: number };
  payments: {
    paymentMethodId: string;
    amount: number;
    referenceNo?: string | null;
  }[];
  idempotencyKey: string;
}

export async function checkoutAction(
  input: CheckoutFormInput
): Promise<CheckoutActionState> {
  const guard = await requirePermission("sale.create");
  if (!guard.ok) {
    return { success: false, message: guard.message, receipt: null };
  }

  const container = await getAppContainer();
  const result = await container.sales.checkout.execute(
    { userId: guard.user.id, idempotencyKey: input.idempotencyKey },
    {
      items: input.items,
      transactionDiscount: input.transactionDiscount,
      payments: input.payments,
      customerId: input.customerId ?? null,
    }
  );

  if (isErr(result)) {
    return { success: false, message: result.error.message, receipt: null };
  }

  const { sale, items, payments } = result.data;
  revalidatePath("/stok");

  return {
    success: true,
    message: `Transaksi ${sale.invoiceNo} berhasil`,
    receipt: {
      saleId: sale.id,
      invoiceNo: sale.invoiceNo,
      createdAt: sale.createdAt.toISOString(),
      cashierName: guard.user.fullName,
      subtotal: sale.subtotal.amount,
      discountTotal: sale.discountTotal.amount,
      grandTotal: sale.grandTotal.amount,
      paidTotal: sale.paidTotal.amount,
      changeAmount: sale.changeAmount.amount,
      items: items.map((item) => ({
        productName: item.productName,
        sku: item.sku,
        qty: item.qty,
        unitPrice: item.unitPrice.amount,
        discount: item.discount.amount,
        subtotal: item.subtotal.amount,
      })),
      payments: payments.map((p) => ({
        paymentMethodName: p.paymentMethodName,
        paymentMethodType: p.paymentMethodType,
        amount: p.amount.amount,
        referenceNo: p.referenceNo,
      })),
    },
  };
}

export interface PaymentMethodDTO {
  id: string;
  name: string;
  type: string;
  isCash: boolean;
}

export async function listActivePaymentMethodsAction(): Promise<
  PaymentMethodDTO[]
> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return [];
  }
  const result = await container.settings.listActivePaymentMethods.execute();
  if (isErr(result)) {
    return [];
  }
  return result.data.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    isCash: m.isCash,
  }));
}

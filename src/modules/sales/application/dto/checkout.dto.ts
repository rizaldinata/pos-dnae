import { z } from "zod";

const DiscountValueSchema = z.object({
  kind: z.enum(["percent", "amount"], { error: "Jenis diskon tidak valid" }),
  value: z
    .number({ error: "Nilai diskon harus angka" })
    .min(0, { error: "Diskon minimal 0" }),
});

export const CheckoutItemSchema = z.object({
  variantId: z.uuid({ error: "ID varian tidak valid" }),
  qty: z
    .number({ error: "Qty harus angka" })
    .positive({ error: "Qty harus lebih dari 0" }),
  discount: DiscountValueSchema.optional(),
});

export const CheckoutPaymentSchema = z.object({
  paymentMethodId: z.uuid({ error: "ID metode bayar tidak valid" }),
  amount: z
    .number({ error: "Nominal harus angka" })
    .positive({ error: "Nominal harus lebih dari 0" }),
  referenceNo: z.string().trim().max(100).nullish(),
});

export const TransactionDiscountSchema = z.object({
  kind: z.enum(["percent", "amount"], { error: "Jenis diskon tidak valid" }),
  value: z
    .number({ error: "Nilai diskon harus angka" })
    .min(0, { error: "Diskon minimal 0" }),
});

export const CheckoutSchema = z.object({
  transactionDiscount: TransactionDiscountSchema.optional(),
  items: z
    .array(CheckoutItemSchema, { error: "Item tidak valid" })
    .min(1, { error: "Keranjang kosong, tidak dapat checkout" })
    .max(100, { error: "Maksimal 100 baris item" }),
  payments: z
    .array(CheckoutPaymentSchema, { error: "Pembayaran tidak valid" })
    .min(1, { error: "Pembayaran wajib diisi" })
    .max(10, { error: "Maksimal 10 metode bayar" }),
  customerId: z.uuid({ error: "ID pelanggan tidak valid" }).nullish(),
  idempotencyKey: z.uuid({ error: "Idempotency key tidak valid" }).optional(),
});

export type CheckoutInput = z.input<typeof CheckoutSchema>;

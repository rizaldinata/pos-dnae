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
  isGift: z.boolean().optional().default(false),
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
  isCredit: z.boolean().optional().default(false),
  // Promo diterapkan otomatis oleh server (PromotionEngine), klien tidak mengirim ID promo.
  voucherCode: z.string().trim().max(20).nullish(),
  // Penukaran poin: jumlah poin; nilai rupiah dihitung server (loyalty.point_value).
  redeemPoints: z
    .number({ error: "Poin harus angka" })
    .int({ error: "Poin harus bilangan bulat" })
    .min(0, { error: "Poin minimal 0" })
    .max(10_000_000, { error: "Poin maksimal 10.000.000" })
    .optional()
    .default(0),
  transactionDiscount: TransactionDiscountSchema.optional(),
  items: z
    .array(CheckoutItemSchema, { error: "Item tidak valid" })
    .min(1, { error: "Keranjang kosong, tidak dapat checkout" })
    .max(100, { error: "Maksimal 100 baris item" }),
  payments: z
    .array(CheckoutPaymentSchema, { error: "Pembayaran tidak valid" })
    .max(10, { error: "Maksimal 10 metode bayar" })
    .optional()
    .default([]),
  customerId: z.uuid({ error: "ID pelanggan tidak valid" }).nullish(),
  idempotencyKey: z.uuid({ error: "Idempotency key tidak valid" }).optional(),
});

export type CheckoutInput = z.input<typeof CheckoutSchema>;

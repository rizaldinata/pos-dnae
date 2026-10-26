import { z } from "zod";

export const PlaceOrderItemSchema = z.object({
  variantId: z.uuid({ error: "ID varian tidak valid" }),
  qty: z
    .number({ error: "Qty harus angka" })
    .int({ error: "Qty harus bilangan bulat" })
    .min(1, { error: "Qty minimal 1" })
    .max(99, { error: "Qty maksimal 99" }),
});

export const PlaceOrderSchema = z
  .object({
    customerName: z
      .string({ error: "Nama wajib diisi" })
      .trim()
      .min(1, { error: "Nama wajib diisi" })
      .max(100, { error: "Nama maksimal 100 karakter" }),
    // Format longgar (spasi/strip/kurung boleh) — konsisten dengan input
    // no. HP kasir; normalisasi dibakukan di sisi DB saat verifikasi.
    customerPhone: z
      .string({ error: "Nomor HP wajib diisi" })
      .trim()
      .regex(/^\+?[\d\s\-()]{8,25}$/, { error: "Nomor HP tidak valid" }),
    fulfillment: z.enum(["pickup", "delivery"], {
      error: "Cara penerimaan tidak valid",
    }),
    address: z
      .string()
      .trim()
      .max(300, { error: "Alamat maksimal 300 karakter" })
      .optional()
      .default(""),
    note: z
      .string()
      .trim()
      .max(300, { error: "Catatan maksimal 300 karakter" })
      .optional()
      .default(""),
    paymentType: z.enum(["cod", "qris"], {
      error: "Metode pembayaran tidak valid",
    }),
    items: z
      .array(PlaceOrderItemSchema, { error: "Item tidak valid" })
      .min(1, { error: "Keranjang kosong" })
      .max(50, { error: "Maksimal 50 baris item" }),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment === "delivery" && data.address.length < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Alamat pengiriman wajib diisi",
      });
    }
    const seen = new Set<string>();
    data.items.forEach((item, index) => {
      if (seen.has(item.variantId)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "variantId"],
          message: "Ada item duplikat — gabungkan qty-nya",
        });
      }
      seen.add(item.variantId);
    });
  });

export type PlaceOrderInput = z.input<typeof PlaceOrderSchema>;
export type PlaceOrderData = z.output<typeof PlaceOrderSchema>;

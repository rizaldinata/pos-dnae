import { z } from "zod";
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "../../domain/entities/order";

const STATUSES = Object.keys(ORDER_STATUS_LABELS) as [
  OrderStatus,
  ...OrderStatus[],
];

export const ListOrdersQuerySchema = z.object({
  status: z.enum(STATUSES).nullish(),
  search: z
    .string()
    .trim()
    .max(50, { error: "Pencarian maksimal 50 karakter" })
    .nullish(),
  page: z
    .number({ error: "Halaman harus angka" })
    .int({ error: "Halaman harus bilangan bulat" })
    .min(1, { error: "Halaman minimal 1" })
    .optional()
    .default(1),
});

export type ListOrdersQuery = z.input<typeof ListOrdersQuerySchema>;

export const UpdateOrderStatusSchema = z.object({
  orderId: z.uuid({ error: "ID pesanan tidak valid" }),
  expectedStatus: z.enum(STATUSES, { error: "Status tidak valid" }),
  nextStatus: z.enum(STATUSES, { error: "Status tidak valid" }),
});

export type UpdateOrderStatusInput = z.input<typeof UpdateOrderStatusSchema>;

export const CancelOrderSchema = z.object({
  orderId: z.uuid({ error: "ID pesanan tidak valid" }),
  reason: z
    .string()
    .trim()
    .max(300, { error: "Alasan maksimal 300 karakter" })
    .optional()
    .default(""),
});

export type CancelOrderInput = z.input<typeof CancelOrderSchema>;

export const ProofUploadSchema = z.object({
  orderNo: z
    .string()
    .trim()
    .regex(/^ORD-\d{8}-\d{1,6}$/, { error: "Nomor pesanan tidak valid" }),
  bytes: z.instanceof(Uint8Array, { error: "Berkas tidak valid" }),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"], {
    error: "Format bukti harus JPG, PNG, atau WebP",
  }),
});

export type ProofUploadInput = z.input<typeof ProofUploadSchema>;

import { z } from "zod";
import { STOCK_MOVEMENT_TYPES } from "@/modules/inventory/domain/entities/stock";

export const StockOverviewQuerySchema = z.object({
  query: z.string().trim().max(100).optional().default(""),
  categoryId: z.uuid({ error: "ID kategori tidak valid" }).nullish(),
  status: z.enum(["normal", "menipis", "habis"]).optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
});

export type StockOverviewQueryInput = z.input<typeof StockOverviewQuerySchema>;

export const StockCardQuerySchema = z.object({
  variantId: z.uuid({ error: "ID varian tidak valid" }),
  type: z.enum(STOCK_MOVEMENT_TYPES).optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
});

export type StockCardQueryInput = z.input<typeof StockCardQuerySchema>;

export const RecordMovementSchema = z.object({
  variantId: z.uuid({ error: "ID varian tidak valid" }),
  type: z.enum(STOCK_MOVEMENT_TYPES, { error: "Tipe pergerakan tidak valid" }),
  qtyChange: z
    .number({ error: "Perubahan qty harus angka" })
    .refine((n) => n !== 0, {
      error: "Perubahan qty tidak boleh 0",
    }),
  refType: z.string().trim().max(50).nullish(),
  refId: z.uuid({ error: "ID referensi tidak valid" }).nullish(),
  note: z.string().trim().max(500).optional().default(""),
});

export type RecordMovementInput = z.input<typeof RecordMovementSchema>;

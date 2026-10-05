import { z } from "zod";

export const CategoryInputSchema = z.object({
  name: z
    .string({ error: "Nama kategori wajib diisi" })
    .trim()
    .min(1, { error: "Nama kategori wajib diisi" })
    .max(100, { error: "Nama kategori maksimal 100 karakter" }),
  parentId: z.uuid({ error: "Kategori induk tidak valid" }).nullish(),
});

export type CategoryInput = z.infer<typeof CategoryInputSchema>;

export const BrandInputSchema = z.object({
  name: z
    .string({ error: "Nama brand wajib diisi" })
    .trim()
    .min(1, { error: "Nama brand wajib diisi" })
    .max(100, { error: "Nama brand maksimal 100 karakter" }),
});

export type BrandInput = z.infer<typeof BrandInputSchema>;

export const UnitInputSchema = z.object({
  name: z
    .string({ error: "Nama satuan wajib diisi" })
    .trim()
    .min(1, { error: "Nama satuan wajib diisi" })
    .max(50, { error: "Nama satuan maksimal 50 karakter" }),
  shortName: z
    .string({ error: "Singkatan wajib diisi" })
    .trim()
    .min(1, { error: "Singkatan wajib diisi" })
    .max(10, { error: "Singkatan maksimal 10 karakter" }),
});

export type UnitInput = z.infer<typeof UnitInputSchema>;

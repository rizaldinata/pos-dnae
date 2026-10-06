import { z } from "zod";

const uuidOptional = z.uuid({ error: "ID tidak valid" }).nullish();

export const VariantInputSchema = z.object({
  id: z.uuid({ error: "ID varian tidak valid" }).optional(),
  sku: z
    .string({ error: "SKU wajib diisi" })
    .trim()
    .min(1, { error: "SKU wajib diisi" })
    .max(50, { error: "SKU maksimal 50 karakter" })
    .transform((s) => s.toUpperCase()),
  barcode: z
    .string()
    .trim()
    .max(50, { error: "Barcode maksimal 50 karakter" })
    .nullish()
    .transform((s) => (s ? s : null)),
  variantName: z
    .string()
    .trim()
    .max(100, { error: "Nama varian maksimal 100 karakter" })
    .optional()
    .default(""),
  costPrice: z
    .number({ error: "Harga modal harus angka" })
    .min(0, { error: "Harga modal minimal 0" }),
  sellPrice: z
    .number({ error: "Harga jual harus angka" })
    .min(0, { error: "Harga jual minimal 0" }),
  minStock: z
    .number({ error: "Stok minimum harus angka" })
    .min(0, { error: "Stok minimum minimal 0" })
    .optional()
    .default(0),
  trackStock: z.boolean().optional().default(true),
});

export type VariantInputDTO = z.infer<typeof VariantInputSchema>;

const ProductBaseSchema = z.object({
  name: z
    .string({ error: "Nama produk wajib diisi" })
    .trim()
    .min(1, { error: "Nama produk wajib diisi" })
    .max(200, { error: "Nama produk maksimal 200 karakter" }),
  categoryId: uuidOptional,
  brandId: uuidOptional,
  unitId: uuidOptional,
  description: z.string().trim().max(2000).optional().default(""),
  imageUrl: z.string().trim().max(500).nullish(),
  isActive: z.boolean().optional().default(true),
  isBundle: z.boolean().optional().default(false),
});

export const CreateProductSchema = ProductBaseSchema.extend({
  variants: z
    .array(VariantInputSchema, { error: "Varian tidak valid" })
    .min(1, { error: "Produk harus memiliki minimal 1 varian" })
    .max(50, { error: "Maksimal 50 varian per produk" }),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type CreateProductRawInput = z.input<typeof CreateProductSchema>;

export const UpdateProductSchema = ProductBaseSchema.partial().extend({
  variants: z
    .array(VariantInputSchema)
    .min(1, { error: "Produk harus memiliki minimal 1 varian" })
    .max(50, { error: "Maksimal 50 varian per produk" })
    .optional(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type UpdateProductRawInput = z.input<typeof UpdateProductSchema>;

export const ListProductsSchema = z.object({
  query: z.string().trim().max(100).optional().default(""),
  categoryId: uuidOptional,
  brandId: uuidOptional,
  isActive: z.boolean().optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
});

export type ListProductsInput = z.infer<typeof ListProductsSchema>;
export type ListProductsRawInput = z.input<typeof ListProductsSchema>;

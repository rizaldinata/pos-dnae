"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import {
  parseImportFile,
  importFileKind,
} from "@/modules/catalog/presentation/lib/parse-import-file";
import {
  IMPORT_COLUMN_KEYS,
  MAX_IMPORT_ROWS,
  type ImportRowEntry,
  type ImportRowPreview,
  type ImportRowValues,
} from "@/modules/catalog/domain/services/import-policy";

export interface ProductActionState {
  success: boolean;
  message: string | null;
  fieldErrors?: Record<string, string[]>;
  productId?: string;
  variants?: { id: string; sku: string }[];
}

const INITIAL: ProductActionState = { success: false, message: null };

function toFieldErrors(error: unknown): Record<string, string[]> | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "validationErrors" in error
  ) {
    return (
      (error as { validationErrors?: Record<string, string[]> })
        .validationErrors ?? undefined
    );
  }
  return undefined;
}

interface VariantFormInput {
  id?: string;
  sku: string;
  barcode?: string | null;
  variantName?: string;
  costPrice: number;
  sellPrice: number;
  minStock?: number;
  trackStock?: boolean;
}

function parseVariants(raw: string): VariantFormInput[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VariantFormInput[]) : null;
  } catch {
    return null;
  }
}

export async function createProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState & { productId?: string }> {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }

  const variants = parseVariants(String(formData.get("variants") ?? "[]"));
  if (!variants) {
    return { ...INITIAL, message: "Data varian tidak valid" };
  }

  const container = await getAppContainer();
  const result = await container.catalog.createProduct.execute({
    name: String(formData.get("name") ?? "").trim(),
    categoryId: (String(formData.get("categoryId") ?? "") || null) as
      string | null,
    brandId: (String(formData.get("brandId") ?? "") || null) as string | null,
    unitId: (String(formData.get("unitId") ?? "") || null) as string | null,
    description: String(formData.get("description") ?? ""),
    imageUrl: (String(formData.get("imageUrl") ?? "") || null) as string | null,
    isActive: formData.get("isActive") === "on",
    isBundle: formData.get("isBundle") === "on",
    variants: variants.map((v) => ({
      sku: String(v.sku ?? ""),
      barcode: v.barcode ?? null,
      variantName: String(v.variantName ?? ""),
      costPrice: Number(v.costPrice) || 0,
      sellPrice: Number(v.sellPrice) || 0,
      minStock: Number(v.minStock) || 0,
      trackStock: v.trackStock !== false,
    })),
  });

  if (isErr(result)) {
    return {
      success: false,
      message: result.error.message,
      fieldErrors: toFieldErrors(result.error),
    };
  }

  revalidatePath("/produk");
  return {
    success: true,
    message: `Produk "${result.data.name}" berhasil dibuat`,
    productId: result.data.id,
    variants: result.data.variants.map((v) => ({ id: v.id, sku: v.sku.value })),
  };
}

export async function updateProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }

  const productId = String(formData.get("productId") ?? "");
  const variants = parseVariants(String(formData.get("variants") ?? "[]"));
  if (!productId || !variants) {
    return { ...INITIAL, message: "Data produk tidak valid" };
  }

  const container = await getAppContainer();
  const result = await container.catalog.updateProduct.execute(productId, {
    name: String(formData.get("name") ?? "").trim(),
    categoryId: (String(formData.get("categoryId") ?? "") || undefined) as
      string | undefined,
    brandId: (String(formData.get("brandId") ?? "") || undefined) as
      string | undefined,
    unitId: (String(formData.get("unitId") ?? "") || undefined) as
      string | undefined,
    description: String(formData.get("description") ?? ""),
    imageUrl: (String(formData.get("imageUrl") ?? "") || undefined) as
      string | undefined,
    isActive: formData.get("isActive") === "on",
    isBundle: formData.get("isBundle") === "on",
    variants: variants.map((v) => ({
      id: v.id || undefined,
      sku: String(v.sku ?? ""),
      barcode: v.barcode ?? null,
      variantName: String(v.variantName ?? ""),
      costPrice: Number(v.costPrice) || 0,
      sellPrice: Number(v.sellPrice) || 0,
      minStock: Number(v.minStock) || 0,
      trackStock: v.trackStock !== false,
    })),
  });

  if (isErr(result)) {
    return {
      success: false,
      message: result.error.message,
      fieldErrors: toFieldErrors(result.error),
    };
  }

  revalidatePath("/produk");
  revalidatePath(`/produk/${productId}`);
  return {
    success: true,
    message: `Produk "${result.data.name}" berhasil diperbarui`,
    productId: result.data.id,
    variants: result.data.variants.map((v) => ({ id: v.id, sku: v.sku.value })),
  };
}

export async function deleteProductAction(
  productId: string
): Promise<ProductActionState> {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }

  const container = await getAppContainer();
  const result = await container.catalog.deleteProduct.execute(productId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }

  revalidatePath("/produk");
  redirect("/produk");
}

export interface VariantOption {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
}

/**
 * Cari varian produk (untuk pemilih komponen bundle). Varian dari produk
 * tertentu dan varian bundle lain dikeluarkan — komponen harus produk lain
 * dan tidak boleh berupa bundle (larangan nesting).
 */
export async function searchVariantsAction(input: {
  query: string;
  excludeProductId?: string;
}): Promise<{ ok: boolean; options: VariantOption[]; message?: string }> {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    return { ok: false, options: [], message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.catalog.searchProducts.execute(
    input.query,
    20
  );
  if (isErr(result)) {
    return { ok: false, options: [], message: result.error.message };
  }
  const options = result.data.items
    .filter((p) => p.id !== input.excludeProductId && !p.isBundle)
    .flatMap((p) =>
      p.variants.map((v) => ({
        variantId: v.id,
        productId: p.id,
        productName: p.name,
        variantName: v.variantName,
        sku: v.sku.value,
      }))
    )
    .slice(0, 30);
  return { ok: true, options };
}

/** Simpan komponen bundle (replace-all untuk seluruh varian produk). */
export async function saveBundleItemsAction(input: {
  productId: string;
  items: { componentVariantId: string; qty: number }[];
}): Promise<ProductActionState> {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    return { ...INITIAL, message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.catalog.saveBundleItems.execute(input);
  if (isErr(result)) {
    return {
      success: false,
      message: result.error.message,
      fieldErrors: toFieldErrors(result.error),
    };
  }
  revalidatePath("/produk");
  revalidatePath(`/produk/${input.productId}`);
  return { success: true, message: "Komponen bundle disimpan" };
}

export type ImportPreviewState =
  | { ok: false; message: string }
  | {
      ok: true;
      rows: ImportRowPreview[];
      newCategories: string[];
      newBrands: string[];
      newUnits: string[];
    };

/**
 * Tahap 1 impor produk (PRD-06): baca file CSV/Excel lalu validasi
 * seluruh baris. File diambil dari FormData dengan key "file".
 */
export async function previewImportProductsAction(
  formData: FormData
): Promise<ImportPreviewState> {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Pilih file CSV atau Excel terlebih dahulu" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, message: "Ukuran file maksimal 5MB" };
  }
  if (!importFileKind(file.name)) {
    return { ok: false, message: "Format file harus .csv atau .xlsx" };
  }

  let rows: string[][];
  try {
    rows = await parseImportFile(file);
  } catch {
    return {
      ok: false,
      message: "File tidak bisa dibaca — pastikan file CSV/Excel yang valid",
    };
  }

  const container = await getAppContainer();
  const result = await container.catalog.previewProductImport.execute(rows);
  if (isErr(result)) {
    return { ok: false, message: result.error.message };
  }
  return {
    ok: true,
    rows: result.data.rows,
    newCategories: result.data.newCategories,
    newBrands: result.data.newBrands,
    newUnits: result.data.newUnits,
  };
}

export interface ImportProductsState {
  success: boolean;
  message: string;
  imported?: number;
  failed?: number;
  errors?: { line: number; message: string }[];
}

function sanitizeImportEntries(raw: unknown): ImportRowEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_IMPORT_ROWS) {
    return null;
  }
  const out: ImportRowEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      return null;
    }
    const { line, values } = item as { line?: unknown; values?: unknown };
    if (typeof line !== "number" || !Number.isFinite(line) || line < 1) {
      return null;
    }
    if (typeof values !== "object" || values === null) {
      return null;
    }
    const source = values as Record<string, unknown>;
    const clean = {} as ImportRowValues;
    for (const key of IMPORT_COLUMN_KEYS) {
      clean[key] = typeof source[key] === "string" ? source[key] : "";
    }
    out.push({ line, values: clean });
  }
  return out;
}

/**
 * Tahap 2 impor produk: konfirmasi → validasi ulang di server → insert
 * bertahap per produk. Mengembalikan laporan berhasil X / gagal Y.
 */
export async function importProductsAction(
  rawEntries: unknown
): Promise<ImportProductsState> {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    return { success: false, message: guard.message };
  }

  const entries = sanitizeImportEntries(rawEntries);
  if (!entries) {
    return {
      success: false,
      message: `Data baris tidak valid — maksimal ${MAX_IMPORT_ROWS} baris`,
    };
  }

  const container = await getAppContainer();
  const result = await container.catalog.importProducts.execute(entries);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }

  const { imported, failed, errors } = result.data;
  revalidatePath("/produk");
  return {
    success: true,
    message:
      failed > 0
        ? `Impor selesai: berhasil ${imported}, gagal ${failed}`
        : `Impor berhasil: ${imported} baris`,
    imported,
    failed,
    errors,
  };
}

export interface LabelVariantOption {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  /** Barcode varian; kosong bila belum diisi. */
  barcode: string | null;
  sellPrice: number;
}

/** Cari varian untuk pemilih cetak label barcode (PRD-07). */
export async function searchLabelVariantsAction(input: {
  query: string;
}): Promise<{ ok: boolean; options: LabelVariantOption[]; message?: string }> {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    return { ok: false, options: [], message: guard.message };
  }
  const container = await getAppContainer();
  const result = await container.catalog.searchProducts.execute(
    input.query,
    30
  );
  if (isErr(result)) {
    return { ok: false, options: [], message: result.error.message };
  }
  const options = result.data.items.flatMap((p) =>
    p.variants.map((v) => ({
      variantId: v.id,
      productName: p.name,
      variantName: v.variantName,
      sku: v.sku.value,
      barcode: v.barcode,
      sellPrice: v.sellPrice.amount,
    }))
  );
  return { ok: true, options };
}

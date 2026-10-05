"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface ProductActionState {
  success: boolean;
  message: string | null;
  fieldErrors?: Record<string, string[]>;
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
    isActive: formData.get("isActive") === "on",
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
    isActive: formData.get("isActive") === "on",
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

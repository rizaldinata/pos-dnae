"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface MasterDataActionState {
  success: boolean;
  message: string | null;
}

const INITIAL: MasterDataActionState = { success: false, message: null };

async function guard(): Promise<null | MasterDataActionState> {
  const result = await requirePermission("product.manage");
  if (!result.ok) {
    return { ...INITIAL, message: result.message };
  }
  return null;
}

function refreshAll(): void {
  revalidatePath("/produk");
  revalidatePath("/produk/kategori");
  revalidatePath("/produk/brand");
  revalidatePath("/produk/satuan");
  revalidatePath("/produk/baru");
}

// ============ KATEGORI ============
export async function createCategoryAction(
  _prevState: MasterDataActionState,
  formData: FormData
): Promise<MasterDataActionState> {
  const denied = await guard();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const parentRaw = String(formData.get("parentId") ?? "");
  const result = await container.catalog.createCategory.execute({
    name: String(formData.get("name") ?? "").trim(),
    parentId: parentRaw === "" ? null : parentRaw,
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshAll();
  return {
    success: true,
    message: `Kategori "${result.data.name}" berhasil dibuat`,
  };
}

export async function updateCategoryAction(
  _prevState: MasterDataActionState,
  formData: FormData
): Promise<MasterDataActionState> {
  const denied = await guard();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const parentRaw = String(formData.get("parentId") ?? "");
  const result = await container.catalog.updateCategory.execute(
    String(formData.get("categoryId") ?? ""),
    {
      name: String(formData.get("name") ?? "").trim(),
      parentId:
        parentRaw === "__root__"
          ? null
          : parentRaw === ""
            ? undefined
            : parentRaw,
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshAll();
  return {
    success: true,
    message: `Kategori "${result.data.name}" berhasil diperbarui`,
  };
}

export async function deleteCategoryAction(
  categoryId: string
): Promise<MasterDataActionState> {
  const denied = await guard();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.catalog.deleteCategory.execute(categoryId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshAll();
  return { success: true, message: "Kategori berhasil dihapus" };
}

// ============ BRAND ============
export async function createBrandAction(
  _prevState: MasterDataActionState,
  formData: FormData
): Promise<MasterDataActionState> {
  const denied = await guard();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.catalog.createBrand.execute({
    name: String(formData.get("name") ?? "").trim(),
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshAll();
  return {
    success: true,
    message: `Brand "${result.data.name}" berhasil dibuat`,
  };
}

export async function updateBrandAction(
  _prevState: MasterDataActionState,
  formData: FormData
): Promise<MasterDataActionState> {
  const denied = await guard();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.catalog.updateBrand.execute(
    String(formData.get("brandId") ?? ""),
    {
      name: String(formData.get("name") ?? "").trim(),
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshAll();
  return {
    success: true,
    message: `Brand "${result.data.name}" berhasil diperbarui`,
  };
}

export async function deleteBrandAction(
  brandId: string
): Promise<MasterDataActionState> {
  const denied = await guard();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.catalog.deleteBrand.execute(brandId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshAll();
  return { success: true, message: "Brand berhasil dihapus" };
}

// ============ SATUAN ============
export async function createUnitAction(
  _prevState: MasterDataActionState,
  formData: FormData
): Promise<MasterDataActionState> {
  const denied = await guard();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.catalog.createUnit.execute({
    name: String(formData.get("name") ?? "").trim(),
    shortName: String(formData.get("shortName") ?? "").trim(),
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshAll();
  return {
    success: true,
    message: `Satuan "${result.data.name}" berhasil dibuat`,
  };
}

export async function updateUnitAction(
  _prevState: MasterDataActionState,
  formData: FormData
): Promise<MasterDataActionState> {
  const denied = await guard();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.catalog.updateUnit.execute(
    String(formData.get("unitId") ?? ""),
    {
      name: String(formData.get("name") ?? "").trim(),
      shortName: String(formData.get("shortName") ?? "").trim(),
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshAll();
  return {
    success: true,
    message: `Satuan "${result.data.name}" berhasil diperbarui`,
  };
}

export async function deleteUnitAction(
  unitId: string
): Promise<MasterDataActionState> {
  const denied = await guard();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.catalog.deleteUnit.execute(unitId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  refreshAll();
  return { success: true, message: "Satuan berhasil dihapus" };
}

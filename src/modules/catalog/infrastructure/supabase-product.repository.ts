import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  CreateProductRecord,
  IProductRepository,
  ProductFilter,
  ProductListResult,
  UpdateProductRecord,
} from "@/modules/catalog/domain/repositories/product.repository";
import {
  Product,
  type ProductVariant,
} from "@/modules/catalog/domain/entities/product";
import {
  DuplicateBarcodeError,
  DuplicateSkuError,
  MasterDataInUseError,
  VariantInUseError,
} from "@/modules/catalog/domain/errors";
import {
  mapProductRow,
  mapVariantRow,
  type ProductRow,
  type VariantRow,
} from "@/modules/catalog/infrastructure/mappers/catalog.mapper";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  ConflictError,
  InvariantViolationError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";

const PRODUCT_SELECT = `
  id,
  category_id,
  brand_id,
  unit_id,
  name,
  description,
  image_url,
  is_bundle,
  is_active,
  created_at,
  updated_at,
  categories ( name ),
  brands ( name ),
  units ( short_name ),
  product_variants (
    id,
    product_id,
    sku,
    barcode,
    variant_name,
    cost_price,
    sell_price,
    min_stock,
    track_stock,
    created_at,
    updated_at,
    stocks ( qty )
  )
`;

const VARIANT_WITH_PRODUCT_SELECT = `
  id,
  product_id,
  sku,
  barcode,
  variant_name,
  cost_price,
  sell_price,
  min_stock,
  track_stock,
  created_at,
  updated_at,
  stocks ( qty )
`;

interface PostgrestErrorLike {
  code?: string;
  message: string;
}

function sanitizeLikeQuery(query: string): string {
  return query
    .replace(/[%_,()"']/g, "")
    .trim()
    .slice(0, 100);
}

export class SupabaseProductRepository implements IProductRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private variantInUseMessage(variantId: string): Promise<boolean> {
    return (async () => {
      const [movements, items] = await Promise.all([
        this.client
          .from("stock_movements")
          .select("id", { count: "exact", head: true })
          .eq("variant_id", variantId),
        this.client
          .from("sale_items")
          .select("id", { count: "exact", head: true })
          .eq("variant_id", variantId),
      ]);
      return (movements.count ?? 0) > 0 || (items.count ?? 0) > 0;
    })();
  }

  public async findById(
    id: string
  ): Promise<Result<Product | null, DomainError>> {
    const { data, error } = await this.client
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapProductRow(data as unknown as ProductRow));
  }

  public async findBySku(
    sku: string
  ): Promise<Result<ProductVariant | null, DomainError>> {
    const { data, error } = await this.client
      .from("product_variants")
      .select(VARIANT_WITH_PRODUCT_SELECT)
      .eq("sku", sku.toUpperCase())
      .maybeSingle();

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapVariantRow(data as unknown as VariantRow));
  }

  public async findByBarcode(
    barcode: string
  ): Promise<Result<ProductVariant | null, DomainError>> {
    const trimmed = barcode.trim();
    if (!trimmed) {
      return ok(null);
    }
    const { data, error } = await this.client
      .from("product_variants")
      .select(VARIANT_WITH_PRODUCT_SELECT)
      .eq("barcode", trimmed)
      .maybeSingle();

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapVariantRow(data as unknown as VariantRow));
  }

  public async search(
    filter: ProductFilter
  ): Promise<Result<ProductListResult, DomainError>> {
    const page = filter.page ?? 1;
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client
      .from("products")
      .select(PRODUCT_SELECT, { count: "exact" })
      .is("deleted_at", null);

    const rawQuery = (filter.query ?? "").trim();
    if (rawQuery) {
      const safe = sanitizeLikeQuery(rawQuery);
      const { data: variantMatches } = await this.client
        .from("product_variants")
        .select("product_id")
        .or(`sku.ilike.%${safe}%,barcode.ilike.%${safe}%`)
        .limit(200);
      const productIds = [
        ...new Set((variantMatches ?? []).map((v) => v.product_id)),
      ];
      if (productIds.length > 0) {
        query = query.or(
          `name.ilike.%${safe}%,id.in.(${productIds.join(",")})`
        );
      } else {
        query = query.ilike("name", `%${safe}%`);
      }
    }

    if (filter.categoryId) {
      query = query.eq("category_id", filter.categoryId);
    }
    if (filter.brandId) {
      query = query.eq("brand_id", filter.brandId);
    }
    if (filter.isActive !== undefined) {
      query = query.eq("is_active", filter.isActive);
    }

    const { data, error, count } = await query.order("name").range(from, to);

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const items = ((data ?? []) as unknown as ProductRow[]).map(mapProductRow);
    return ok({ items, total: count ?? 0, page, pageSize });
  }

  public async create(
    record: CreateProductRecord
  ): Promise<Result<Product, DomainError>> {
    const { data: product, error: productError } = await this.client
      .from("products")
      .insert({
        name: record.name,
        category_id: record.categoryId ?? null,
        brand_id: record.brandId ?? null,
        unit_id: record.unitId ?? null,
        description: record.description ?? "",
        image_url: record.imageUrl ?? null,
        is_active: record.isActive ?? true,
      })
      .select("id")
      .single();

    if (productError || !product) {
      return err(this.mapWriteError(productError as PostgrestErrorLike | null));
    }

    const productId = (product as { id: string }).id;
    const { error: variantError } = await this.client
      .from("product_variants")
      .insert(
        record.variants.map((v) => ({
          product_id: productId,
          sku: v.sku.toUpperCase(),
          barcode: v.barcode?.trim() ? v.barcode.trim() : null,
          variant_name: v.variantName ?? "",
          cost_price: v.costPrice,
          sell_price: v.sellPrice,
          min_stock: v.minStock ?? 0,
          track_stock: v.trackStock ?? true,
        }))
      );

    if (variantError) {
      await this.client.from("products").delete().eq("id", productId);
      return err(this.mapWriteError(variantError as PostgrestErrorLike));
    }

    const { data: variantIds, error: variantIdsError } = await this.client
      .from("product_variants")
      .select("id")
      .eq("product_id", productId);

    if (variantIdsError || !variantIds) {
      return err(
        new InvariantViolationError(
          `Database error: ${variantIdsError?.message ?? "unknown"}`
        )
      );
    }

    const { error: stockError } = await this.client
      .from("stocks")
      .insert(variantIds.map((v) => ({ variant_id: v.id, qty: 0 })));

    if (stockError) {
      return err(
        new InvariantViolationError(`Database error: ${stockError.message}`)
      );
    }

    const created = await this.findById(productId);
    if (!created.success) {
      return err(created.error);
    }
    if (created.data === null) {
      return err(
        new InvariantViolationError("Produk gagal dimuat setelah dibuat")
      );
    }
    return ok(created.data);
  }

  public async update(
    id: string,
    patch: UpdateProductRecord
  ): Promise<Result<Product, DomainError>> {
    const productPayload: {
      name?: string;
      category_id?: string | null;
      brand_id?: string | null;
      unit_id?: string | null;
      description?: string;
      image_url?: string | null;
      is_active?: boolean;
    } = {};
    if (patch.name !== undefined) {
      productPayload.name = patch.name;
    }
    if (patch.categoryId !== undefined) {
      productPayload.category_id = patch.categoryId;
    }
    if (patch.brandId !== undefined) {
      productPayload.brand_id = patch.brandId;
    }
    if (patch.unitId !== undefined) {
      productPayload.unit_id = patch.unitId;
    }
    if (patch.description !== undefined) {
      productPayload.description = patch.description;
    }
    if (patch.imageUrl !== undefined) {
      productPayload.image_url = patch.imageUrl;
    }
    if (patch.isActive !== undefined) {
      productPayload.is_active = patch.isActive;
    }

    if (Object.keys(productPayload).length > 0) {
      const { error } = await this.client
        .from("products")
        .update(productPayload)
        .eq("id", id);
      if (error) {
        return err(this.mapWriteError(error as PostgrestErrorLike));
      }
    }

    if (patch.variants !== undefined) {
      const variantsResult = await this.syncVariants(id, patch.variants);
      if (!variantsResult.success) {
        return err(variantsResult.error);
      }
    }

    const updated = await this.findById(id);
    if (!updated.success) {
      return err(updated.error);
    }
    if (updated.data === null) {
      return err(
        new InvariantViolationError("Produk gagal dimuat setelah diperbarui")
      );
    }
    return ok(updated.data);
  }

  private async syncVariants(
    productId: string,
    inputs: NonNullable<UpdateProductRecord["variants"]>
  ): Promise<Result<void, DomainError>> {
    const { data: current, error: currentError } = await this.client
      .from("product_variants")
      .select("id,sku")
      .eq("product_id", productId);

    if (currentError || !current) {
      return err(
        new InvariantViolationError(
          `Database error: ${currentError?.message ?? "unknown"}`
        )
      );
    }

    const currentIds = new Set(current.map((v) => v.id));
    const inputIds = new Set(
      inputs.filter((v) => v.id).map((v) => v.id as string)
    );

    for (const input of inputs) {
      const payload = {
        product_id: productId,
        sku: input.sku.toUpperCase(),
        barcode: input.barcode?.trim() ? input.barcode.trim() : null,
        variant_name: input.variantName ?? "",
        cost_price: input.costPrice,
        sell_price: input.sellPrice,
        min_stock: input.minStock ?? 0,
        track_stock: input.trackStock ?? true,
      };
      if (input.id && currentIds.has(input.id)) {
        const { error } = await this.client
          .from("product_variants")
          .update(payload)
          .eq("id", input.id);
        if (error) {
          return err(this.mapWriteError(error as PostgrestErrorLike));
        }
      } else {
        const { data: inserted, error } = await this.client
          .from("product_variants")
          .insert(payload)
          .select("id")
          .single();
        if (error || !inserted) {
          return err(this.mapWriteError(error as PostgrestErrorLike | null));
        }
        const newId = (inserted as { id: string }).id;
        const { error: stockError } = await this.client
          .from("stocks")
          .insert({ variant_id: newId, qty: 0 });
        if (stockError) {
          return err(
            new InvariantViolationError(`Database error: ${stockError.message}`)
          );
        }
      }
    }

    const toRemove = [...currentIds].filter(
      (variantId) => !inputIds.has(variantId)
    );
    for (const variantId of toRemove) {
      const sku = current.find((v) => v.id === variantId)?.sku ?? variantId;
      if (await this.variantInUseMessage(variantId)) {
        return err(new VariantInUseError(sku));
      }
      const { error } = await this.client
        .from("stocks")
        .delete()
        .eq("variant_id", variantId);
      if (error) {
        return err(
          new InvariantViolationError(`Database error: ${error.message}`)
        );
      }
      const { error: deleteError } = await this.client
        .from("product_variants")
        .delete()
        .eq("id", variantId);
      if (deleteError) {
        return err(
          new InvariantViolationError(`Database error: ${deleteError.message}`)
        );
      }
    }

    return ok(undefined);
  }

  public async softDelete(id: string): Promise<Result<void, DomainError>> {
    const { error } = await this.client
      .from("products")
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(undefined);
  }

  private mapWriteError(error: PostgrestErrorLike | null): DomainError {
    const message = error?.message ?? "unknown";
    if (error?.code === "23505") {
      if (message.includes("barcode")) {
        return new DuplicateBarcodeError("");
      }
      const skuMatch = /Key \(sku\)=\(([^)]+)\)/.exec(message);
      return new DuplicateSkuError(skuMatch?.[1] ?? "");
    }
    if (error?.code === "23503") {
      return new ValidationError("Kategori, brand, atau satuan tidak valid");
    }
    return new InvariantViolationError(`Database error: ${message}`);
  }
}

export function conflictOrInvariant(
  error: PostgrestErrorLike | null,
  inUseName?: string
): DomainError {
  if (error?.code === "23503" && inUseName) {
    return new MasterDataInUseError(inUseName);
  }
  if (error?.code === "23505") {
    return new ConflictError("Data sudah ada (duplikat)");
  }
  return new InvariantViolationError(
    `Database error: ${error?.message ?? "unknown"}`
  );
}

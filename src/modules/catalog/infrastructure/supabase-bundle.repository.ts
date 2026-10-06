import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  BundleComponent,
  BundleItemInput,
  ComponentInfo,
  IBundleRepository,
} from "@/modules/catalog/domain/repositories/bundle.repository";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

export class SupabaseBundleRepository implements IBundleRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async listByProduct(
    productId: string
  ): Promise<Result<BundleComponent[], DomainError>> {
    const { data: variants, error: variantError } = await this.client
      .from("product_variants")
      .select("id")
      .eq("product_id", productId)
      .order("sku");

    if (variantError) {
      return err(
        new InvariantViolationError(`Database error: ${variantError.message}`)
      );
    }
    const firstVariantId = variants?.[0]?.id;
    if (!firstVariantId) {
      return ok([]);
    }

    const { data: rows, error } = await this.client
      .from("bundle_items")
      .select(
        `component_variant_id,
         qty,
         product_variants!bundle_items_component_variant_id_fkey (
           product_id,
           sku,
           variant_name,
           products ( name )
         )`
      )
      .eq("bundle_variant_id", firstVariantId);

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }

    const items = (rows ?? []) as unknown as {
      component_variant_id: string;
      qty: number | string;
      product_variants: {
        product_id: string;
        sku: string;
        variant_name: string;
        products: { name: string } | null;
      } | null;
    }[];

    const componentIds = items.map((r) => r.component_variant_id);
    const stockByVariant = await this.fetchStockQty(componentIds);
    if (!stockByVariant.success) {
      return err(stockByVariant.error);
    }
    const stockQtyByVariant = stockByVariant.data;

    const components: BundleComponent[] = items
      .filter((r) => r.product_variants !== null)
      .map((r) => ({
        variantId: r.component_variant_id,
        productId: r.product_variants!.product_id,
        productName: r.product_variants!.products?.name ?? "-",
        variantName: r.product_variants!.variant_name,
        sku: r.product_variants!.sku,
        qty: Number(r.qty),
        stockQty: stockQtyByVariant[r.component_variant_id] ?? 0,
      }))
      .sort(
        (a, b) =>
          a.productName.localeCompare(b.productName) ||
          a.sku.localeCompare(b.sku)
      );

    return ok(components);
  }

  public async describeComponents(
    variantIds: string[]
  ): Promise<Result<Record<string, ComponentInfo>, DomainError>> {
    if (variantIds.length === 0) {
      return ok({});
    }
    const { data, error } = await this.client
      .from("product_variants")
      .select(
        `id,
         product_id,
         sku,
         variant_name,
         products ( name, is_bundle )`
      )
      .in("id", variantIds);

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }

    const rows = (data ?? []) as unknown as {
      id: string;
      product_id: string;
      sku: string;
      variant_name: string;
      products: { name: string; is_bundle: boolean } | null;
    }[];

    const result: Record<string, ComponentInfo> = {};
    for (const row of rows) {
      result[row.id] = {
        productId: row.product_id,
        productName: row.products?.name ?? "-",
        variantName: row.variant_name,
        sku: row.sku,
        isBundle: row.products?.is_bundle ?? false,
      };
    }
    return ok(result);
  }

  public async replaceForProduct(
    productId: string,
    items: BundleItemInput[]
  ): Promise<Result<void, DomainError>> {
    const { data: variants, error: variantError } = await this.client
      .from("product_variants")
      .select("id")
      .eq("product_id", productId);

    if (variantError) {
      return err(
        new InvariantViolationError(`Database error: ${variantError.message}`)
      );
    }
    const variantIds = (variants ?? []).map((v) => v.id);
    if (variantIds.length === 0) {
      return err(new InvariantViolationError("Produk belum memiliki varian"));
    }

    const { error: deleteError } = await this.client
      .from("bundle_items")
      .delete()
      .in("bundle_variant_id", variantIds);

    if (deleteError) {
      return err(
        new InvariantViolationError(`Database error: ${deleteError.message}`)
      );
    }

    if (items.length > 0) {
      const rows = variantIds.flatMap((variantId) =>
        items.map((item) => ({
          bundle_variant_id: variantId,
          component_variant_id: item.componentVariantId,
          qty: item.qty,
        }))
      );
      const { error: insertError } = await this.client
        .from("bundle_items")
        .insert(rows);

      if (insertError) {
        return err(
          new InvariantViolationError(`Database error: ${insertError.message}`)
        );
      }
    }

    return ok(undefined);
  }

  private async fetchStockQty(
    variantIds: string[]
  ): Promise<Result<Record<string, number>, DomainError>> {
    const result: Record<string, number> = {};
    if (variantIds.length === 0) {
      return ok(result);
    }
    const { data, error } = await this.client
      .from("stocks")
      .select("variant_id,qty")
      .in("variant_id", variantIds);

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    for (const row of data ?? []) {
      result[row.variant_id] = Number(row.qty);
    }
    return ok(result);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { mapRecordToStoreSettings } from "@/modules/settings/domain/entities/store-setting";
import type {
  StorefrontProduct,
  StorefrontSettings,
  StorefrontVariant,
} from "../domain/entities/order";
import type { IStorefrontCatalogPort } from "../domain/repositories/storefront-catalog.port";

interface StorefrontVariantRow {
  id: string;
  variant_name: string | null;
  sell_price: number;
  track_stock: boolean;
  stocks: { qty: number } | null;
}

interface StorefrontProductRow {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  categories: { name: string } | null;
  product_variants: StorefrontVariantRow[];
}

const PRODUCT_SELECT = `
  id,
  name,
  description,
  image_url,
  categories ( name ),
  product_variants!inner (
    id,
    variant_name,
    sell_price,
    track_stock,
    stocks ( qty )
  )
`;

function mapVariant(
  row: StorefrontVariantRow,
  productName: string
): StorefrontVariant {
  const stockQty = row.track_stock ? Number(row.stocks?.qty ?? 0) : null;
  return {
    id: row.id,
    name: row.variant_name?.trim() || productName,
    sellPrice: Number(row.sell_price),
    isAvailable: stockQty === null || stockQty > 0,
  };
}

/**
 * Katalog publik (landing page). Service-role client karena RLS melarang
 * anon membaca products/categories/settings.
 */
export class SupabaseStorefrontCatalogRepository implements IStorefrontCatalogPort {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async listProducts(): Promise<
    Result<StorefrontProduct[], DomainError>
  > {
    const { data, error } = await this.client
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      // !inner: hanya produk dengan minimal satu varian aktif yang tampil.
      .is("product_variants.deleted_at", null)
      .order("name");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const rows = (data ?? []) as unknown as StorefrontProductRow[];
    return ok(
      rows.map((row) => ({
        productId: row.id,
        name: row.name,
        description: row.description ?? "",
        imageUrl: row.image_url ?? "",
        categoryName: row.categories?.name ?? "",
        variants: row.product_variants.map((v) => mapVariant(v, row.name)),
      }))
    );
  }

  public async getSettings(): Promise<Result<StorefrontSettings, DomainError>> {
    const { data, error } = await this.client
      .from("settings")
      .select("key,value");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const record: Record<string, unknown> = {};
    for (const row of (data ?? []) as { key: string; value: unknown }[]) {
      record[row.key] = row.value;
    }
    const settings = mapRecordToStoreSettings(record);
    return ok({
      storeName: settings.storeName,
      storeAddress: settings.storeAddress,
      storePhone: settings.storePhone,
      storeLogoUrl: settings.storeLogoUrl,
      qrisImagePath: settings.qrisImageUrl,
    });
  }
}

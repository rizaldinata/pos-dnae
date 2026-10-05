import {
  Product,
  ProductVariant,
} from "@/modules/catalog/domain/entities/product";
import { Category } from "@/modules/catalog/domain/entities/category";
import { Brand } from "@/modules/catalog/domain/entities/brand";
import { Unit } from "@/modules/catalog/domain/entities/unit";
import { Sku } from "@/modules/catalog/domain/value-objects/sku";
import { Money } from "@/shared/lib/money";

export interface VariantRow {
  id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  variant_name: string;
  cost_price: number | string;
  sell_price: number | string;
  min_stock: number | string;
  track_stock: boolean;
  created_at: string;
  updated_at: string;
  stocks: { qty: number | string } | null;
}

export interface ProductRow {
  id: string;
  category_id: string | null;
  brand_id: string | null;
  unit_id: string | null;
  name: string;
  description: string;
  image_url: string | null;
  is_bundle: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  categories: { name: string } | null;
  brands: { name: string } | null;
  units: { short_name: string } | null;
  product_variants: VariantRow[];
}

export function mapVariantRow(row: VariantRow): ProductVariant {
  const stockQty = row.stocks ? Number(row.stocks.qty) : undefined;
  return ProductVariant.create(
    {
      productId: row.product_id,
      sku: Sku.create(row.sku),
      barcode: row.barcode,
      variantName: row.variant_name,
      costPrice: Money.create(Math.round(Number(row.cost_price))),
      sellPrice: Money.create(Math.round(Number(row.sell_price))),
      minStock: Number(row.min_stock),
      trackStock: row.track_stock,
      stockQty: Number.isFinite(stockQty) ? stockQty : undefined,
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }
  );
}

export function mapProductRow(row: ProductRow): Product {
  return Product.create(
    {
      name: row.name,
      categoryId: row.category_id,
      brandId: row.brand_id,
      unitId: row.unit_id,
      description: row.description,
      imageUrl: row.image_url,
      isBundle: row.is_bundle,
      isActive: row.is_active,
      categoryName: row.categories?.name ?? null,
      brandName: row.brands?.name ?? null,
      unitShortName: row.units?.short_name ?? null,
      variants: (row.product_variants ?? []).map(mapVariantRow),
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }
  );
}

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export function mapCategoryRow(row: CategoryRow): Category {
  return Category.create({ name: row.name, parentId: row.parent_id }, row.id, {
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

export function mapBrandRow(row: {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}): Brand {
  return Brand.create({ name: row.name }, row.id, {
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

export function mapUnitRow(row: {
  id: string;
  name: string;
  short_name: string;
  created_at: string;
  updated_at: string;
}): Unit {
  return Unit.create({ name: row.name, shortName: row.short_name }, row.id, {
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

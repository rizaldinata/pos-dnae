import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { Product } from "@/modules/catalog/domain/entities/product";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export interface POSVariant {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  displayName: string;
  sku: string;
  barcode: string | null;
  sellPrice: number;
  costPrice: number;
  stockQty: number | null;
  trackStock: boolean;
  minStock: number;
}

export interface POSProduct {
  productId: string;
  name: string;
  categoryName: string | null;
  variants: POSVariant[];
}

function toPOSProduct(product: Product): POSProduct {
  return {
    productId: product.id,
    name: product.name,
    categoryName: product.categoryName ?? null,
    variants: product.variants.map((v) => ({
      variantId: v.id,
      productId: product.id,
      productName: product.name,
      variantName: v.variantName,
      displayName: v.variantName
        ? `${product.name} — ${v.variantName}`
        : product.name,
      sku: v.sku.value,
      barcode: v.barcode,
      sellPrice: v.sellPrice.amount,
      costPrice: v.costPrice.amount,
      stockQty: v.stockQty ?? null,
      trackStock: v.trackStock,
      minStock: v.minStock,
    })),
  };
}

export class SearchProductsForPOSUseCase {
  constructor(private readonly products: IProductRepository) {}

  public async execute(
    query: string,
    limit = 24
  ): Promise<Result<POSProduct[], DomainError>> {
    const trimmed = query.trim().slice(0, 100);
    const result = await this.products.search({
      query: trimmed || undefined,
      isActive: true,
      page: 1,
      pageSize: Math.min(Math.max(limit, 1), 50),
    });
    if (isErr(result)) {
      return err(result.error);
    }
    return ok(result.data.items.map(toPOSProduct));
  }
}

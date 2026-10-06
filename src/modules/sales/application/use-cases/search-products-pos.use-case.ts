import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { IPriceTierRepository } from "@/modules/catalog/domain/repositories/price-tier.repository";
import type { Product } from "@/modules/catalog/domain/entities/product";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export interface POSTier {
  minQty: number;
  price: number;
}

export interface POSVariant {
  variantId: string;
  productId: string;
  categoryId: string | null;
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
  /** true bila varian berasal dari produk bundle (opsional: tidak semua sumber tahu). */
  isBundle?: boolean;
  tiers: POSTier[];
}

export interface POSProduct {
  productId: string;
  name: string;
  categoryName: string | null;
  imageUrl: string | null;
  variants: POSVariant[];
}

function toPOSProduct(
  product: Product,
  tiersByVariant: Record<string, POSTier[]>
): POSProduct {
  return {
    productId: product.id,
    name: product.name,
    categoryName: product.categoryName ?? null,
    imageUrl: product.imageUrl,
    variants: product.variants.map((v) => ({
      variantId: v.id,
      productId: product.id,
      categoryId: product.categoryId,
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
      isBundle: product.isBundle,
      tiers: tiersByVariant[v.id] ?? [],
    })),
  };
}

export class SearchProductsForPOSUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly priceTiers: IPriceTierRepository
  ) {}

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
    const variantIds = result.data.items.flatMap((p) =>
      p.variants.map((v) => v.id)
    );
    const tiersResult = await this.priceTiers.listByVariantIds(variantIds);
    if (isErr(tiersResult)) {
      return err(tiersResult.error);
    }
    const tiersByVariant = tiersResult.data;
    return ok(
      result.data.items.map((product) =>
        toPOSProduct(
          product,
          Object.fromEntries(
            Object.entries(tiersByVariant).map(([variantId, tiers]) => [
              variantId,
              tiers.map((t) => ({ minQty: t.minQty, price: t.price.amount })),
            ])
          )
        )
      )
    );
  }
}

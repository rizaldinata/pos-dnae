import { describe, expect, it } from "vitest";
import { SearchProductsForPOSUseCase } from "@/modules/sales/application/use-cases/search-products-pos.use-case";
import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { IPriceTierRepository } from "@/modules/catalog/domain/repositories/price-tier.repository";
import {
  Product,
  ProductVariant,
} from "@/modules/catalog/domain/entities/product";
import { Sku } from "@/modules/catalog/domain/value-objects/sku";
import { Money } from "@/shared/lib/money";
import { ok } from "@/shared/kernel/result";

function makeProduct(id: string, name: string, isActive: boolean): Product {
  return Product.create(
    {
      name,
      categoryId: null,
      brandId: null,
      unitId: null,
      description: "",
      imageUrl: null,
      isBundle: false,
      isActive,
      variants: [
        ProductVariant.create(
          {
            productId: id,
            sku: Sku.create(`SKU-${id}`),
            barcode: null,
            variantName: "",
            costPrice: Money.create(1000),
            sellPrice: Money.create(2000),
            minStock: 0,
            trackStock: true,
            stockQty: 10,
          },
          `v-${id}`
        ),
      ],
    },
    id
  );
}

describe("SearchProductsForPOSUseCase", () => {
  function setup(products: Product[]) {
    let received: { query?: string; isActive?: boolean; pageSize?: number } =
      {};
    const repo: IProductRepository = {
      findById: async () => ok(null),
      findBySku: async () => ok(null),
      findByBarcode: async () => ok(null),
      findVariantById: async () => ok(null),
      search: async (filter) => {
        received = filter;
        const items = products.filter((p) =>
          filter.query
            ? p.name.toLowerCase().includes(filter.query.toLowerCase())
            : true
        );
        return ok({ items, total: items.length, page: 1, pageSize: 20 });
      },
      create: async () => {
        throw new Error("not used");
      },
      update: async () => {
        throw new Error("not used");
      },
      softDelete: async () => ok(undefined),
    };
    const tiers: IPriceTierRepository = {
      listByVariant: async () => ok([]),
      listByVariantIds: async () => ok({}),
      setTiers: async () => ok([]),
    };
    return {
      useCase: new SearchProductsForPOSUseCase(repo, tiers),
      received: () => received,
    };
  }

  it("hanya mencari produk aktif", async () => {
    const { useCase, received } = setup([
      makeProduct("p-1", "Mie", true),
      makeProduct("p-2", "Susu", false),
    ]);
    const result = await useCase.execute("mie");
    expect(result.success).toBe(true);
    expect(received().isActive).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.variants[0]?.sellPrice).toBe(2000);
    }
  });

  it("query kosong mengembalikan semua (untuk grid awal)", async () => {
    const { useCase } = setup([makeProduct("p-1", "Mie", true)]);
    const result = await useCase.execute("");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
  });
});

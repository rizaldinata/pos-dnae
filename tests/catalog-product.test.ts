import { describe, expect, it } from "vitest";
import { CreateProductUseCase } from "@/modules/catalog/application/use-cases/create-product.use-case";
import { UpdateProductUseCase } from "@/modules/catalog/application/use-cases/product.use-cases";
import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import {
  Product,
  ProductVariant,
} from "@/modules/catalog/domain/entities/product";
import { Sku } from "@/modules/catalog/domain/value-objects/sku";
import { Money } from "@/shared/lib/money";
import { DuplicateSkuError } from "@/modules/catalog/domain/errors";
import { NotFoundError, ValidationError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";

function makeVariant(
  id: string,
  productId: string,
  sku: string
): ProductVariant {
  return ProductVariant.create(
    {
      productId,
      sku: Sku.create(sku),
      barcode: null,
      variantName: "",
      costPrice: Money.create(1000),
      sellPrice: Money.create(1500),
      minStock: 0,
      trackStock: true,
    },
    id
  );
}

function setup(store: { products: Product[] }) {
  const repo: IProductRepository = {
    findById: async (id) => ok(store.products.find((p) => p.id === id) ?? null),
    findBySku: async (sku) => {
      for (const p of store.products) {
        const found = p.variants.find((v) => v.sku.value === sku.toUpperCase());
        if (found) {
          return ok(found);
        }
      }
      return ok(null);
    },
    findByBarcode: async () => ok(null),
    search: async () => ok({ items: [], total: 0, page: 1, pageSize: 20 }),
    create: async (record) => {
      const id = `p-${store.products.length + 1}`;
      const product = Product.create(
        {
          name: record.name,
          categoryId: record.categoryId ?? null,
          brandId: record.brandId ?? null,
          unitId: record.unitId ?? null,
          description: record.description ?? "",
          imageUrl: null,
          isBundle: false,
          isActive: true,
          variants: record.variants.map((v, i) =>
            makeVariant(`v-${id}-${i}`, id, v.sku)
          ),
        },
        id
      );
      store.products.push(product);
      return ok(product);
    },
    update: async (id, patch) => {
      const existing = store.products.find((p) => p.id === id);
      if (!existing) {
        throw new Error("not found in fake");
      }
      const updated = Product.create(
        {
          name: patch.name ?? existing.name,
          categoryId: existing.categoryId,
          brandId: existing.brandId,
          unitId: existing.unitId,
          description: existing.description,
          imageUrl: existing.imageUrl,
          isBundle: false,
          isActive: existing.isActive,
          variants: existing.variants,
        },
        existing.id
      );
      store.products = store.products.map((p) => (p.id === id ? updated : p));
      return ok(updated);
    },
    softDelete: async () => ok(undefined),
  };
  return {
    createUseCase: new CreateProductUseCase(repo),
    updateUseCase: new UpdateProductUseCase(repo),
  };
}

const validInput = {
  name: "Mie Instan",
  variants: [{ sku: "MIE-1", costPrice: 2900, sellPrice: 3500 }],
};

describe("CreateProductUseCase", () => {
  it("membuat produk dengan 1 varian", async () => {
    const { createUseCase } = setup({ products: [] });
    const result = await createUseCase.execute(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variants).toHaveLength(1);
      expect(result.data.variants[0]?.sku.value).toBe("MIE-1");
    }
  });

  it("menolak produk tanpa varian", async () => {
    const { createUseCase } = setup({ products: [] });
    const result = await createUseCase.execute({
      name: "Tanpa varian",
      variants: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("menolak SKU duplikat dalam satu request", async () => {
    const { createUseCase } = setup({ products: [] });
    const result = await createUseCase.execute({
      name: "Duplikat",
      variants: [
        { sku: "SAMA", costPrice: 100, sellPrice: 200 },
        { sku: "sama", costPrice: 100, sellPrice: 200 },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DuplicateSkuError);
    }
  });

  it("menolak SKU yang sudah dipakai produk lain", async () => {
    const existing = Product.create(
      {
        name: "Lama",
        categoryId: null,
        brandId: null,
        unitId: null,
        description: "",
        imageUrl: null,
        isBundle: false,
        isActive: true,
        variants: [makeVariant("v-0", "p-0", "LAMA-1")],
      },
      "p-0"
    );
    const { createUseCase } = setup({ products: [existing] });
    const result = await createUseCase.execute({
      name: "Baru",
      variants: [{ sku: "lama-1", costPrice: 100, sellPrice: 200 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DuplicateSkuError);
    }
  });
});

describe("UpdateProductUseCase", () => {
  it("menolak produk yang tidak ada", async () => {
    const { updateUseCase } = setup({ products: [] });
    const result = await updateUseCase.execute("p-tidak-ada", { name: "Baru" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it("mengizinkan SKU milik sendiri saat update", async () => {
    const existing = Product.create(
      {
        name: "Lama",
        categoryId: null,
        brandId: null,
        unitId: null,
        description: "",
        imageUrl: null,
        isBundle: false,
        isActive: true,
        variants: [makeVariant("v-1", "p-1", "SENDIRI")],
      },
      "p-1"
    );
    const { updateUseCase } = setup({ products: [existing] });
    const result = await updateUseCase.execute("p-1", { name: "Baru" });
    expect(result.success).toBe(true);
  });
});

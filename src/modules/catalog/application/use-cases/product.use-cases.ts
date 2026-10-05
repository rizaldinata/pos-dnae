import type {
  IProductRepository,
  ProductListResult,
} from "@/modules/catalog/domain/repositories/product.repository";
import type { Product } from "@/modules/catalog/domain/entities/product";
import type {
  ListProductsRawInput,
  UpdateProductRawInput,
} from "@/modules/catalog/application/dto/product.dto";
import {
  ListProductsSchema,
  UpdateProductSchema,
} from "@/modules/catalog/application/dto/product.dto";
import { DuplicateSkuError } from "@/modules/catalog/domain/errors";
import { NotFoundError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { toFieldErrors } from "@/modules/catalog/application/use-cases/create-product.use-case";

export class GetProductUseCase {
  constructor(private readonly products: IProductRepository) {}

  public async execute(id: string): Promise<Result<Product, DomainError>> {
    const result = await this.products.findById(id);
    if (isErr(result)) {
      return err(result.error);
    }
    if (result.data === null) {
      return err(new NotFoundError("Produk", id));
    }
    return ok(result.data);
  }
}

export class ListProductsUseCase {
  constructor(private readonly products: IProductRepository) {}

  public async execute(
    rawInput: ListProductsRawInput
  ): Promise<Result<ProductListResult, DomainError>> {
    const parsed = ListProductsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError("Filter tidak valid", toFieldErrors(parsed.error))
      );
    }
    return this.products.search({
      query: parsed.data.query || undefined,
      categoryId: parsed.data.categoryId ?? undefined,
      brandId: parsed.data.brandId ?? undefined,
      isActive: parsed.data.isActive,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  }
}

export class SearchProductsUseCase {
  constructor(private readonly products: IProductRepository) {}

  public async execute(
    query: string,
    limit = 20
  ): Promise<Result<ProductListResult, DomainError>> {
    return this.products.search({
      query,
      page: 1,
      pageSize: Math.min(Math.max(limit, 1), 50),
    });
  }
}

export class UpdateProductUseCase {
  constructor(private readonly products: IProductRepository) {}

  public async execute(
    id: string,
    rawInput: UpdateProductRawInput
  ): Promise<Result<Product, DomainError>> {
    const parsed = UpdateProductSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data produk tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }

    const existing = await this.products.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Produk", id));
    }

    if (parsed.data.variants) {
      const ownVariantIds = new Set(existing.data.variants.map((v) => v.id));
      const seen = new Set<string>();
      for (const variant of parsed.data.variants) {
        if (seen.has(variant.sku)) {
          return err(new DuplicateSkuError(variant.sku));
        }
        seen.add(variant.sku);

        const conflict = await this.products.findBySku(variant.sku);
        if (isErr(conflict)) {
          return err(conflict.error);
        }
        if (conflict.data !== null && !ownVariantIds.has(conflict.data.id)) {
          return err(new DuplicateSkuError(variant.sku));
        }
      }
    }

    return this.products.update(id, {
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      brandId: parsed.data.brandId,
      unitId: parsed.data.unitId,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl,
      isActive: parsed.data.isActive,
      variants: parsed.data.variants?.map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode,
        variantName: v.variantName,
        costPrice: v.costPrice,
        sellPrice: v.sellPrice,
        minStock: v.minStock,
        trackStock: v.trackStock,
      })),
    });
  }
}

export class DeleteProductUseCase {
  constructor(private readonly products: IProductRepository) {}

  public async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.products.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Produk", id));
    }
    return this.products.softDelete(id);
  }
}

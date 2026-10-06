import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { CreateProductRawInput } from "@/modules/catalog/application/dto/product.dto";
import { CreateProductSchema } from "@/modules/catalog/application/dto/product.dto";
import type { Product } from "@/modules/catalog/domain/entities/product";
import { DuplicateSkuError } from "@/modules/catalog/domain/errors";
import { err, isErr, type Result } from "@/shared/kernel/result";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";

import { z } from "zod";

export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class CreateProductUseCase {
  constructor(private readonly products: IProductRepository) {}

  public async execute(
    rawInput: CreateProductRawInput
  ): Promise<Result<Product, DomainError>> {
    const parsed = CreateProductSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data produk tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }

    const seen = new Set<string>();
    for (const variant of parsed.data.variants) {
      if (seen.has(variant.sku)) {
        return err(new DuplicateSkuError(variant.sku));
      }
      seen.add(variant.sku);

      const existing = await this.products.findBySku(variant.sku);
      if (isErr(existing)) {
        return err(existing.error);
      }
      if (existing.data !== null) {
        return err(new DuplicateSkuError(variant.sku));
      }
    }

    return this.products.create({
      name: parsed.data.name,
      categoryId: parsed.data.categoryId ?? null,
      brandId: parsed.data.brandId ?? null,
      unitId: parsed.data.unitId ?? null,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl ?? null,
      isActive: parsed.data.isActive,
      isBundle: parsed.data.isBundle,
      variants: parsed.data.variants.map((v) => ({
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

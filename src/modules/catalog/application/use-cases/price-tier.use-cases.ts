import { z } from "zod";
import type { IPriceTierRepository } from "@/modules/catalog/domain/repositories/price-tier.repository";
import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { PriceTier } from "@/modules/catalog/domain/entities/price-tier";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, type Result } from "@/shared/kernel/result";

export const PriceTierInputSchema = z.object({
  minQty: z
    .number({ error: "Qty minimum harus angka" })
    .positive({ error: "Qty minimum harus lebih dari 0" }),
  price: z
    .number({ error: "Harga harus angka" })
    .min(0, { error: "Harga minimal 0" }),
});

export const SetPriceTiersSchema = z.object({
  tiers: z
    .array(PriceTierInputSchema, { error: "Tier tidak valid" })
    .max(10, { error: "Maksimal 10 tier per varian" }),
});

export type SetPriceTiersInput = z.input<typeof SetPriceTiersSchema>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class GetPriceTiersUseCase {
  constructor(private readonly tiers: IPriceTierRepository) {}

  public async execute(
    variantId: string
  ): Promise<Result<PriceTier[], DomainError>> {
    return this.tiers.listByVariant(variantId);
  }
}

export class SetPriceTiersUseCase {
  constructor(
    private readonly tiers: IPriceTierRepository,
    private readonly products: IProductRepository
  ) {}

  public async execute(
    variantId: string,
    rawInput: SetPriceTiersInput
  ): Promise<Result<PriceTier[], DomainError>> {
    const parsed = SetPriceTiersSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data harga grosir tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }

    const variantResult = await this.products.findVariantById(variantId);
    if (isErr(variantResult)) {
      return err(variantResult.error);
    }
    if (variantResult.data === null) {
      return err(new NotFoundError("Varian produk", variantId));
    }

    const seen = new Set<number>();
    for (const tier of parsed.data.tiers) {
      const minQty = Math.floor(tier.minQty);
      if (seen.has(minQty)) {
        return err(new ValidationError(`Qty minimum ${minQty} duplikat`));
      }
      seen.add(minQty);
      if (tier.price >= variantResult.data.variant.sellPrice.amount) {
        return err(
          new ValidationError(
            `Harga grosir (${tier.price}) harus lebih kecil dari harga reguler (${variantResult.data.variant.sellPrice.amount})`
          )
        );
      }
    }

    return this.tiers.setTiers(
      variantId,
      parsed.data.tiers.map((t) => ({
        minQty: Math.floor(t.minQty),
        price: Math.round(t.price),
      }))
    );
  }
}

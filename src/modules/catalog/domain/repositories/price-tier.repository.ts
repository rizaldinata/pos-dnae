import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { PriceTier } from "@/modules/catalog/domain/entities/price-tier";

export interface PriceTierInput {
  minQty: number;
  price: number;
}

export interface IPriceTierRepository {
  listByVariant(variantId: string): Promise<Result<PriceTier[], DomainError>>;
  listByVariantIds(
    variantIds: string[]
  ): Promise<Result<Record<string, PriceTier[]>, DomainError>>;
  setTiers(
    variantId: string,
    tiers: PriceTierInput[]
  ): Promise<Result<PriceTier[], DomainError>>;
}

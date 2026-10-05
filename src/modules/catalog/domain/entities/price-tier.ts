import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";
import { Money } from "@/shared/lib/money";
import { ValidationError } from "@/shared/kernel/errors";

export interface PriceTierProps {
  variantId: string;
  minQty: number;
  price: Money;
}

export class PriceTier extends BaseEntity<PriceTierProps> {
  private constructor(
    props: PriceTierProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: PriceTierProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): PriceTier {
    if (!Number.isFinite(props.minQty) || props.minQty <= 0) {
      throw new ValidationError("Qty minimum tier harus lebih dari 0");
    }
    return new PriceTier(props, id, timestamps);
  }

  public get variantId(): string {
    return this._props.variantId;
  }

  public get minQty(): number {
    return this._props.minQty;
  }

  public get price(): Money {
    return this._props.price;
  }
}

/**
 * Harga berlaku untuk qty: tier dengan minQty terbesar yang terpenuhi,
 * atau harga reguler bila tidak ada tier yang cocok.
 */
export function priceForQty(
  tiers: { minQty: number; price: Money }[],
  qty: number,
  regularPrice: Money
): Money {
  let best: { minQty: number; price: Money } | null = null;
  for (const tier of tiers) {
    if (qty >= tier.minQty && (!best || tier.minQty > best.minQty)) {
      best = tier;
    }
  }
  return best ? best.price : regularPrice;
}

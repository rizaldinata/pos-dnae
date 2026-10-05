import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  IPriceTierRepository,
  PriceTierInput,
} from "@/modules/catalog/domain/repositories/price-tier.repository";
import { PriceTier } from "@/modules/catalog/domain/entities/price-tier";
import { Money } from "@/shared/lib/money";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

interface PriceTierRow {
  id: string;
  variant_id: string;
  min_qty: number | string;
  price: number | string;
  created_at: string;
}

const TIER_SELECT = "id,variant_id,min_qty,price,created_at";

function mapRow(row: PriceTierRow): PriceTier {
  return PriceTier.create(
    {
      variantId: row.variant_id,
      minQty: Math.floor(Number(row.min_qty)),
      price: Money.create(Math.round(Number(row.price))),
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.created_at) }
  );
}

export class SupabasePriceTierRepository implements IPriceTierRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async listByVariant(
    variantId: string
  ): Promise<Result<PriceTier[], DomainError>> {
    const { data, error } = await this.client
      .from("price_tiers")
      .select(TIER_SELECT)
      .eq("variant_id", variantId)
      .order("min_qty");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(((data ?? []) as unknown as PriceTierRow[]).map(mapRow));
  }

  public async listByVariantIds(
    variantIds: string[]
  ): Promise<Result<Record<string, PriceTier[]>, DomainError>> {
    if (variantIds.length === 0) {
      return ok({});
    }
    const { data, error } = await this.client
      .from("price_tiers")
      .select(TIER_SELECT)
      .in("variant_id", variantIds)
      .order("min_qty");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const grouped: Record<string, PriceTier[]> = {};
    for (const row of (data ?? []) as unknown as PriceTierRow[]) {
      const tier = mapRow(row);
      (grouped[tier.variantId] ??= []).push(tier);
    }
    return ok(grouped);
  }

  public async setTiers(
    variantId: string,
    tiers: PriceTierInput[]
  ): Promise<Result<PriceTier[], DomainError>> {
    const { error: deleteError } = await this.client
      .from("price_tiers")
      .delete()
      .eq("variant_id", variantId);
    if (deleteError) {
      return err(
        new InvariantViolationError(`Database error: ${deleteError.message}`)
      );
    }
    if (tiers.length === 0) {
      return ok([]);
    }
    const { data, error } = await this.client
      .from("price_tiers")
      .insert(
        tiers.map((t) => ({
          variant_id: variantId,
          min_qty: t.minQty,
          price: t.price,
        }))
      )
      .select(TIER_SELECT);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(((data ?? []) as unknown as PriceTierRow[]).map(mapRow));
  }
}

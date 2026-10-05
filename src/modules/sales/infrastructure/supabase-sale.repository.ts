import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  ISaleRepository,
  SaleSummary,
} from "@/modules/sales/domain/repositories/sale.repository";
import { ok, type Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export class SupabaseSaleRepository implements ISaleRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async findById(
    id: string
  ): Promise<Result<SaleSummary | null, DomainError>> {
    // Skeleton implementation (will be connected to real table in Phase 1)
    return ok({
      id,
      invoiceNumber: `INV-${Date.now()}`,
      totalAmount: 0,
    });
  }

  public async create(payload: {
    totalAmount: number;
  }): Promise<Result<SaleSummary, DomainError>> {
    // Skeleton implementation
    return ok({
      id: `sale-${Date.now()}`,
      invoiceNumber: `INV-${Date.now()}`,
      totalAmount: payload.totalAmount,
    });
  }
}

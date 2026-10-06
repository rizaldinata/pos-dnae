import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { LoyaltyTransaction } from "@/modules/customers/domain/entities/loyalty";

export interface AdjustLoyaltyRecord {
  customerId: string;
  /** Bertanda: positif menambah, negatif mengurangi. */
  points: number;
  note: string;
}

export interface ILoyaltyRepository {
  listByCustomer(
    customerId: string,
    limit?: number
  ): Promise<Result<LoyaltyTransaction[], DomainError>>;
  /** Penyesuaian manual oleh admin; atomic lewat RPC `adjust_loyalty_points`. */
  adjust(
    record: AdjustLoyaltyRecord
  ): Promise<Result<LoyaltyTransaction, DomainError>>;
}

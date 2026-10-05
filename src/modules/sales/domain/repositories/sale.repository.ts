import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export interface SaleSummary {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
}

export interface ISaleRepository {
  findById(id: string): Promise<Result<SaleSummary | null, DomainError>>;
  create(payload: {
    totalAmount: number;
  }): Promise<Result<SaleSummary, DomainError>>;
}

import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  SupplierDebt,
  SupplierPayment,
} from "@/modules/purchasing/domain/entities/supplier-debt";

export type DebtStatus = "unpaid" | "partial" | "paid" | "overdue";

export interface DebtListFilter {
  supplierId?: string;
  status?: DebtStatus;
  overdueOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface DebtListResult {
  items: SupplierDebt[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecordDebtPaymentInput {
  poId: string;
  amount: number;
  method?: string;
  dueDate?: string | null;
  note?: string;
}

export interface ISupplierDebtRepository {
  listDebts(
    filter: DebtListFilter
  ): Promise<Result<DebtListResult, DomainError>>;
  getPayments(poId: string): Promise<Result<SupplierPayment[], DomainError>>;
  recordPayment(
    input: RecordDebtPaymentInput
  ): Promise<Result<SupplierPayment, DomainError>>;
}

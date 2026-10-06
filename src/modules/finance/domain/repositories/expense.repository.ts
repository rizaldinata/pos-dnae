import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  Expense,
  ExpenseCategory,
} from "@/modules/finance/domain/entities/expense";

export interface CreateExpenseRecord {
  categoryId: string;
  amount: number;
  note?: string;
  /** YYYY-MM-DD; bila kosong memakai hari ini di sisi database. */
  expenseDate?: string;
  createdBy: string;
}

export interface UpdateExpenseRecord {
  categoryId?: string;
  amount?: number;
  note?: string;
  expenseDate?: string;
}

export interface ExpenseFilter {
  /** YYYY-MM-DD */
  dateFrom?: string;
  /** YYYY-MM-DD */
  dateTo?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

export interface ExpenseListResult {
  items: Expense[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IExpenseRepository {
  findAll(
    filter: ExpenseFilter
  ): Promise<Result<ExpenseListResult, DomainError>>;
  findById(id: string): Promise<Result<Expense | null, DomainError>>;
  create(record: CreateExpenseRecord): Promise<Result<Expense, DomainError>>;
  update(
    id: string,
    patch: UpdateExpenseRecord
  ): Promise<Result<Expense, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

export interface IExpenseCategoryRepository {
  findAll(): Promise<Result<ExpenseCategory[], DomainError>>;
  findById(id: string): Promise<Result<ExpenseCategory | null, DomainError>>;
  create(name: string): Promise<Result<ExpenseCategory, DomainError>>;
  update(
    id: string,
    name: string
  ): Promise<Result<ExpenseCategory, DomainError>>;
  delete(id: string): Promise<Result<void, DomainError>>;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  CreateExpenseRecord,
  ExpenseFilter,
  ExpenseListResult,
  IExpenseCategoryRepository,
  IExpenseRepository,
  UpdateExpenseRecord,
} from "@/modules/finance/domain/repositories/expense.repository";
import {
  Expense,
  ExpenseCategory,
} from "@/modules/finance/domain/entities/expense";
import { Money } from "@/shared/lib/money";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";
import {
  ConflictError,
  InvariantViolationError,
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";

type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
type ExpenseCategoryRow =
  Database["public"]["Tables"]["expense_categories"]["Row"];

const EXPENSE_SELECT =
  "id,category_id,amount,note,expense_date,created_by,created_at,updated_at";
const CATEGORY_SELECT = "id,name,created_at,updated_at";

function mapExpense(row: ExpenseRow): Expense {
  return Expense.create(
    {
      categoryId: row.category_id,
      amount: Money.create(Number(row.amount)),
      note: row.note ?? "",
      expenseDate: String(row.expense_date).slice(0, 10),
      createdBy: row.created_by,
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }
  );
}

function mapCategory(row: ExpenseCategoryRow): ExpenseCategory {
  return ExpenseCategory.create({ name: row.name }, row.id, {
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function toDomainError(
  error: { code?: string; message: string } | null,
  options?: { inUseMessage?: string }
): DomainError {
  if (error?.code === "23503" && options?.inUseMessage) {
    return new ValidationError(options.inUseMessage);
  }
  if (error?.code === "23503") {
    return new ValidationError("Kategori pengeluaran tidak ditemukan");
  }
  if (error?.code === "23505") {
    return new ConflictError("Nama kategori sudah dipakai");
  }
  return new InvariantViolationError(
    `Database error: ${error?.message ?? "unknown"}`
  );
}

export class SupabaseExpenseRepository implements IExpenseRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async findAll(
    filter: ExpenseFilter
  ): Promise<Result<ExpenseListResult, DomainError>> {
    const page = Math.max(filter.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client
      .from("expenses")
      .select(EXPENSE_SELECT, { count: "exact" });
    if (filter.dateFrom) {
      query = query.gte("expense_date", filter.dateFrom);
    }
    if (filter.dateTo) {
      query = query.lte("expense_date", filter.dateTo);
    }
    if (filter.categoryId) {
      query = query.eq("category_id", filter.categoryId);
    }
    const { data, error, count } = await query
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      return err(toDomainError({ code: error.code, message: error.message }));
    }
    return ok({
      items: ((data ?? []) as ExpenseRow[]).map(mapExpense),
      total: count ?? 0,
      page,
      pageSize,
    });
  }

  public async findById(
    id: string
  ): Promise<Result<Expense | null, DomainError>> {
    const { data, error } = await this.client
      .from("expenses")
      .select(EXPENSE_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return err(toDomainError({ code: error.code, message: error.message }));
    }
    return ok(data === null ? null : mapExpense(data as ExpenseRow));
  }

  public async create(
    record: CreateExpenseRecord
  ): Promise<Result<Expense, DomainError>> {
    const payload: Database["public"]["Tables"]["expenses"]["Insert"] = {
      category_id: record.categoryId,
      amount: record.amount,
      note: record.note ?? "",
      created_by: record.createdBy,
    };
    if (record.expenseDate) {
      payload.expense_date = record.expenseDate;
    }
    const { data, error } = await this.client
      .from("expenses")
      .insert(payload)
      .select(EXPENSE_SELECT)
      .single();
    if (error || !data) {
      return err(
        toDomainError(
          error ? { code: error.code, message: error.message } : null
        )
      );
    }
    return ok(mapExpense(data as ExpenseRow));
  }

  public async update(
    id: string,
    patch: UpdateExpenseRecord
  ): Promise<Result<Expense, DomainError>> {
    const payload: Database["public"]["Tables"]["expenses"]["Update"] = {};
    if (patch.categoryId !== undefined) payload.category_id = patch.categoryId;
    if (patch.amount !== undefined) payload.amount = patch.amount;
    if (patch.note !== undefined) payload.note = patch.note;
    if (patch.expenseDate !== undefined)
      payload.expense_date = patch.expenseDate;
    if (Object.keys(payload).length === 0) {
      const current = await this.findById(id);
      if (isErr(current)) {
        return err(current.error);
      }
      if (current.data === null) {
        return err(new NotFoundError("Pengeluaran", id));
      }
      return ok(current.data);
    }
    const { data, error } = await this.client
      .from("expenses")
      .update(payload)
      .eq("id", id)
      .select(EXPENSE_SELECT)
      .single();
    if (error || !data) {
      if (error?.code === "PGRST116") {
        return err(new NotFoundError("Pengeluaran", id));
      }
      return err(
        toDomainError(
          error ? { code: error.code, message: error.message } : null
        )
      );
    }
    return ok(mapExpense(data as ExpenseRow));
  }

  public async delete(id: string): Promise<Result<void, DomainError>> {
    const { error } = await this.client.from("expenses").delete().eq("id", id);
    if (error) {
      return err(toDomainError({ code: error.code, message: error.message }));
    }
    return ok(undefined);
  }
}

export class SupabaseExpenseCategoryRepository implements IExpenseCategoryRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async findAll(): Promise<Result<ExpenseCategory[], DomainError>> {
    const { data, error } = await this.client
      .from("expense_categories")
      .select(CATEGORY_SELECT)
      .order("name");
    if (error) {
      return err(toDomainError({ code: error.code, message: error.message }));
    }
    return ok(((data ?? []) as ExpenseCategoryRow[]).map(mapCategory));
  }

  public async findById(
    id: string
  ): Promise<Result<ExpenseCategory | null, DomainError>> {
    const { data, error } = await this.client
      .from("expense_categories")
      .select(CATEGORY_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return err(toDomainError({ code: error.code, message: error.message }));
    }
    return ok(data === null ? null : mapCategory(data as ExpenseCategoryRow));
  }

  public async create(
    name: string
  ): Promise<Result<ExpenseCategory, DomainError>> {
    const { data, error } = await this.client
      .from("expense_categories")
      .insert({ name })
      .select(CATEGORY_SELECT)
      .single();
    if (error || !data) {
      return err(
        toDomainError(
          error ? { code: error.code, message: error.message } : null
        )
      );
    }
    return ok(mapCategory(data as ExpenseCategoryRow));
  }

  public async update(
    id: string,
    name: string
  ): Promise<Result<ExpenseCategory, DomainError>> {
    const { data, error } = await this.client
      .from("expense_categories")
      .update({ name })
      .eq("id", id)
      .select(CATEGORY_SELECT)
      .single();
    if (error || !data) {
      if (error?.code === "PGRST116") {
        return err(new NotFoundError("Kategori pengeluaran", id));
      }
      return err(
        toDomainError(
          error ? { code: error.code, message: error.message } : null
        )
      );
    }
    return ok(mapCategory(data as ExpenseCategoryRow));
  }

  public async delete(id: string): Promise<Result<void, DomainError>> {
    const { error } = await this.client
      .from("expense_categories")
      .delete()
      .eq("id", id);
    if (error) {
      return err(
        toDomainError(
          { code: error.code, message: error.message },
          { inUseMessage: "Kategori masih dipakai pengeluaran" }
        )
      );
    }
    return ok(undefined);
  }
}

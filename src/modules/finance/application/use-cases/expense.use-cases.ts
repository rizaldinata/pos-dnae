import { z } from "zod";
import type {
  ExpenseFilter,
  ExpenseListResult,
  IExpenseCategoryRepository,
  IExpenseRepository,
} from "@/modules/finance/domain/repositories/expense.repository";
import type {
  Expense,
  ExpenseCategory,
} from "@/modules/finance/domain/entities/expense";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const ExpenseCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "Nama kategori minimal 2 karakter" })
    .max(60, { error: "Nama kategori maksimal 60 karakter" }),
});

export type ExpenseCategoryInput = z.input<typeof ExpenseCategorySchema>;

export const ExpenseSchema = z.object({
  categoryId: z.uuid({ error: "Kategori wajib dipilih" }),
  amount: z
    .number()
    .positive({ error: "Nominal harus lebih dari 0" })
    .max(1_000_000_000, { error: "Nominal maksimal Rp1.000.000.000" }),
  note: z
    .string()
    .trim()
    .max(300, { error: "Catatan maksimal 300 karakter" })
    .optional()
    .default(""),
  expenseDate: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal harus YYYY-MM-DD" }),
});

export type ExpenseInput = z.input<typeof ExpenseSchema>;

export const ExpensePatchSchema = z.object({
  categoryId: z.uuid({ error: "Kategori wajib dipilih" }).optional(),
  amount: z
    .number()
    .positive({ error: "Nominal harus lebih dari 0" })
    .max(1_000_000_000, { error: "Nominal maksimal Rp1.000.000.000" })
    .optional(),
  note: z
    .string()
    .trim()
    .max(300, { error: "Catatan maksimal 300 karakter" })
    .optional(),
  expenseDate: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal harus YYYY-MM-DD" })
    .optional(),
});

export type ExpensePatchInput = z.input<typeof ExpensePatchSchema>;

export const ExpenseFilterSchema = z
  .object({
    dateFrom: z
      .string()
      .regex(DATE_PATTERN, { error: "Tanggal mulai harus YYYY-MM-DD" })
      .optional(),
    dateTo: z
      .string()
      .regex(DATE_PATTERN, { error: "Tanggal selesai harus YYYY-MM-DD" })
      .optional(),
    categoryId: z.uuid({ error: "ID kategori tidak valid" }).nullish(),
    page: z.number().int().min(1).optional().default(1),
    pageSize: z.number().int().min(1).max(100).optional().default(20),
  })
  .refine(
    (value) =>
      !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    { error: "Tanggal mulai tidak boleh setelah selesai" }
  );

export type ExpenseFilterInput = z.input<typeof ExpenseFilterSchema>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class ListExpenseCategoriesUseCase {
  constructor(private readonly categories: IExpenseCategoryRepository) {}

  public async execute(): Promise<Result<ExpenseCategory[], DomainError>> {
    return this.categories.findAll();
  }
}

export class CreateExpenseCategoryUseCase {
  constructor(private readonly categories: IExpenseCategoryRepository) {}

  public async execute(
    rawInput: ExpenseCategoryInput
  ): Promise<Result<ExpenseCategory, DomainError>> {
    const parsed = ExpenseCategorySchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data kategori tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    return this.categories.create(parsed.data.name);
  }
}

export class UpdateExpenseCategoryUseCase {
  constructor(private readonly categories: IExpenseCategoryRepository) {}

  public async execute(
    id: string,
    rawInput: ExpenseCategoryInput
  ): Promise<Result<ExpenseCategory, DomainError>> {
    const parsed = ExpenseCategorySchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data kategori tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await this.categories.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Kategori pengeluaran", id));
    }
    return this.categories.update(id, parsed.data.name);
  }
}

export class DeleteExpenseCategoryUseCase {
  constructor(private readonly categories: IExpenseCategoryRepository) {}

  public async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.categories.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Kategori pengeluaran", id));
    }
    return this.categories.delete(id);
  }
}

export class RecordExpenseUseCase {
  constructor(
    private readonly expenses: IExpenseRepository,
    private readonly categories: IExpenseCategoryRepository
  ) {}

  public async execute(
    createdBy: string,
    rawInput: ExpenseInput
  ): Promise<Result<Expense, DomainError>> {
    const parsed = ExpenseSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data pengeluaran tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const category = await this.categories.findById(parsed.data.categoryId);
    if (isErr(category)) {
      return err(category.error);
    }
    if (category.data === null) {
      return err(
        new NotFoundError("Kategori pengeluaran", parsed.data.categoryId)
      );
    }
    return this.expenses.create({
      categoryId: parsed.data.categoryId,
      amount: Math.round(parsed.data.amount),
      note: parsed.data.note,
      expenseDate: parsed.data.expenseDate,
      createdBy,
    });
  }
}

export class ListExpensesUseCase {
  constructor(private readonly expenses: IExpenseRepository) {}

  public async execute(
    rawInput: ExpenseFilterInput = {}
  ): Promise<Result<ExpenseFilter, DomainError>> {
    const parsed = ExpenseFilterSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Filter pengeluaran tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    return ok({
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
      categoryId: parsed.data.categoryId ?? undefined,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  }

  /** Terapkan filter tervalidasi ke repository. */
  public async list(
    rawInput: ExpenseFilterInput = {}
  ): Promise<Result<ExpenseListResult, DomainError>> {
    const filter = await this.execute(rawInput);
    if (isErr(filter)) {
      return err(filter.error);
    }
    return this.expenses.findAll(filter.data);
  }
}

export class UpdateExpenseUseCase {
  constructor(private readonly expenses: IExpenseRepository) {}

  public async execute(
    id: string,
    rawInput: ExpensePatchInput
  ): Promise<Result<Expense, DomainError>> {
    const parsed = ExpensePatchSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data pengeluaran tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await this.expenses.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Pengeluaran", id));
    }
    return this.expenses.update(id, {
      categoryId: parsed.data.categoryId,
      amount:
        parsed.data.amount !== undefined
          ? Math.round(parsed.data.amount)
          : undefined,
      note: parsed.data.note,
      expenseDate: parsed.data.expenseDate,
    });
  }
}

export class DeleteExpenseUseCase {
  constructor(private readonly expenses: IExpenseRepository) {}

  public async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.expenses.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Pengeluaran", id));
    }
    return this.expenses.delete(id);
  }
}

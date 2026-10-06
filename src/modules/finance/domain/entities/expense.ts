import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";
import { Money } from "@/shared/lib/money";

export interface ExpenseCategoryProps {
  name: string;
}

/** Kategori pengeluaran operasional (FIN-01). */
export class ExpenseCategory extends BaseEntity<ExpenseCategoryProps> {
  private constructor(
    props: ExpenseCategoryProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: ExpenseCategoryProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): ExpenseCategory {
    return new ExpenseCategory(
      { ...props, name: props.name.trim() },
      id,
      timestamps
    );
  }

  public get name(): string {
    return this._props.name;
  }
}

export interface ExpenseProps {
  categoryId: string;
  amount: Money;
  note: string;
  /** Tanggal kejadian pengeluaran dalam format YYYY-MM-DD (bukan timestamp). */
  expenseDate: string;
  createdBy: string | null;
}

/** Catatan pengeluaran operasional (FIN-01). */
export class Expense extends BaseEntity<ExpenseProps> {
  private constructor(
    props: ExpenseProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: ExpenseProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Expense {
    return new Expense({ ...props, note: props.note.trim() }, id, timestamps);
  }

  public get categoryId(): string {
    return this._props.categoryId;
  }

  public get amount(): Money {
    return this._props.amount;
  }

  public get note(): string {
    return this._props.note;
  }

  public get expenseDate(): string {
    return this._props.expenseDate;
  }

  public get createdBy(): string | null {
    return this._props.createdBy;
  }
}

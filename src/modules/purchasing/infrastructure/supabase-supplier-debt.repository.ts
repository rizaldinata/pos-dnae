import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  DebtListFilter,
  DebtListResult,
  DebtStatus,
  ISupplierDebtRepository,
  RecordDebtPaymentInput,
} from "@/modules/purchasing/domain/repositories/supplier-debt.repository";
import {
  SupplierDebt,
  SupplierPayment,
} from "@/modules/purchasing/domain/entities/supplier-debt";
import { Money } from "@/shared/lib/money";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

interface PORow {
  id: string;
  po_no: string;
  supplier_id: string;
  status: string;
  order_date: string;
  total: number | string;
  suppliers: { name: string; payment_terms_days: number } | null;
}

interface PaymentRow {
  id: string;
  po_id: string;
  amount: number | string;
  method: string;
  paid_at: string;
  due_date: string | null;
  note: string;
}

const VALID_STATUSES = ["draft", "sent", "partial", "completed", "cancelled"];

export class SupabaseSupplierDebtRepository implements ISupplierDebtRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private async loadPOs(supplierId?: string): Promise<
    Result<
      {
        po: PORow;
        paid: number;
      }[],
      DomainError
    >
  > {
    let poQuery = this.client
      .from("purchase_orders")
      .select(
        "id,po_no,supplier_id,status,order_date,total,suppliers ( name, payment_terms_days )"
      )
      .not("status", "in", "(draft,cancelled)")
      .order("order_date", { ascending: false });
    if (supplierId) {
      poQuery = poQuery.eq("supplier_id", supplierId);
    }
    const { data: pos, error: poError } = await poQuery;
    if (poError) {
      return err(
        new InvariantViolationError(`Database error: ${poError.message}`)
      );
    }
    const poRows = (pos ?? []) as unknown as PORow[];
    if (poRows.length === 0) {
      return ok([]);
    }

    const { data: payments, error: payError } = await this.client
      .from("supplier_payments")
      .select("po_id,amount")
      .in(
        "po_id",
        poRows.map((po) => po.id)
      );
    if (payError) {
      return err(
        new InvariantViolationError(`Database error: ${payError.message}`)
      );
    }
    const paidByPO = new Map<string, number>();
    for (const p of (payments ?? []) as {
      po_id: string;
      amount: number | string;
    }[]) {
      paidByPO.set(
        p.po_id,
        (paidByPO.get(p.po_id) ?? 0) + Math.round(Number(p.amount))
      );
    }
    return ok(poRows.map((po) => ({ po, paid: paidByPO.get(po.id) ?? 0 })));
  }

  private toDebt(po: PORow, paid: number): SupplierDebt {
    const total = Math.round(Number(po.total));
    const remaining = Math.max(total - paid, 0);
    const terms = po.suppliers?.payment_terms_days ?? 0;
    const orderDate = new Date(`${po.order_date}T00:00:00+07:00`);
    orderDate.setDate(orderDate.getDate() + terms);
    const dueDate = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}-${String(orderDate.getDate()).padStart(2, "0")}`;
    return SupplierDebt.create(
      {
        poId: po.id,
        poNo: po.po_no,
        supplierId: po.supplier_id,
        supplierName: po.suppliers?.name ?? "-",
        orderDate: po.order_date,
        total: Money.create(total),
        paid: Money.create(paid),
        remaining: Money.create(remaining),
        dueDate,
      },
      po.id
    );
  }

  public async listDebts(
    filter: DebtListFilter
  ): Promise<Result<DebtListResult, DomainError>> {
    const loaded = await this.loadPOs(filter.supplierId);
    if (!loaded.success) {
      return err(loaded.error);
    }
    let debts = loaded.data.map(({ po, paid }) => this.toDebt(po, paid));

    if (filter.status === "paid") {
      debts = debts.filter((d) => d.isPaid);
    } else if (filter.status === "partial") {
      debts = debts.filter((d) => !d.isPaid && d.paid.amount > 0);
    } else if (filter.status === "unpaid") {
      debts = debts.filter((d) => !d.isPaid && d.paid.amount <= 0);
    } else if (filter.status === "overdue" || filter.overdueOnly) {
      debts = debts.filter((d) => d.isOverdue);
    }

    const page = filter.page ?? 1;
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const total = debts.length;
    const items = debts.slice((page - 1) * pageSize, page * pageSize);
    return ok({ items, total, page, pageSize });
  }

  public async getPayments(
    poId: string
  ): Promise<Result<SupplierPayment[], DomainError>> {
    const { data, error } = await this.client
      .from("supplier_payments")
      .select("id,po_id,amount,method,paid_at,due_date,note")
      .eq("po_id", poId)
      .order("paid_at", { ascending: false });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(
      ((data ?? []) as unknown as PaymentRow[]).map((row) =>
        SupplierPayment.create(
          {
            poId: row.po_id,
            amount: Money.create(Math.round(Number(row.amount))),
            method: row.method,
            paidAt: new Date(row.paid_at),
            dueDate: row.due_date,
            note: row.note,
          },
          row.id
        )
      )
    );
  }

  public async recordPayment(
    input: RecordDebtPaymentInput
  ): Promise<Result<SupplierPayment, DomainError>> {
    const { data, error } = await this.client
      .from("supplier_payments")
      .insert({
        po_id: input.poId,
        amount: input.amount,
        method: input.method ?? "Tunai",
        due_date: input.dueDate ?? null,
        note: input.note ?? "",
      })
      .select("id,po_id,amount,method,paid_at,due_date,note")
      .single();
    if (error || !data) {
      return err(
        new InvariantViolationError(
          `Database error: ${error?.message ?? "unknown"}`
        )
      );
    }
    const row = data as unknown as PaymentRow;
    return ok(
      SupplierPayment.create(
        {
          poId: row.po_id,
          amount: Money.create(Math.round(Number(row.amount))),
          method: row.method,
          paidAt: new Date(row.paid_at),
          dueDate: row.due_date,
          note: row.note,
        },
        row.id
      )
    );
  }
}

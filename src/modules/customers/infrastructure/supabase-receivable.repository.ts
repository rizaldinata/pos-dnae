import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type { IReceivableRepository } from "@/modules/customers/application/use-cases/receivable.use-cases";
import type { CustomerReceivable } from "@/modules/customers/domain/entities/receivable";
import { Money } from "@/shared/lib/money";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  receivable_balance: number | string;
}

export class SupabaseReceivableRepository implements IReceivableRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async listReceivables(
    query?: string
  ): Promise<Result<CustomerReceivable[], DomainError>> {
    let request = this.client
      .from("customers")
      .select("id,name,phone,receivable_balance")
      .is("deleted_at", null)
      .gt("receivable_balance", 0)
      .order("receivable_balance", { ascending: false });
    if (query) {
      const safe = query
        .replace(/[%_,()"']/g, "")
        .trim()
        .slice(0, 100);
      request = request.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }
    const { data, error } = await request;
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const customers = (data ?? []) as unknown as CustomerRow[];
    if (customers.length === 0) {
      return ok([]);
    }

    const { data: sales, error: salesError } = await this.client
      .from("sales")
      .select("customer_id,created_at")
      .in(
        "customer_id",
        customers.map((c) => c.id)
      )
      .eq("status", "credit")
      .order("created_at", { ascending: false });
    if (salesError) {
      return err(
        new InvariantViolationError(`Database error: ${salesError.message}`)
      );
    }
    const lastSale = new Map<string, string>();
    for (const s of (sales ?? []) as {
      customer_id: string;
      created_at: string;
    }[]) {
      if (!lastSale.has(s.customer_id)) {
        lastSale.set(s.customer_id, s.created_at);
      }
    }

    return ok(
      customers.map((c) => ({
        customerId: c.id,
        customerName: c.name,
        phone: c.phone,
        balance: Money.create(Math.round(Number(c.receivable_balance))),
        lastSaleAt: lastSale.has(c.id)
          ? new Date(lastSale.get(c.id) as string)
          : null,
      }))
    );
  }

  public async recordPayment(input: {
    customerId: string;
    saleId?: string | null;
    amount: number;
    paymentMethodId?: string | null;
    note?: string;
  }): Promise<Result<{ newBalance: number }, DomainError>> {
    const { data, error } = await this.client.rpc("record_receivable_payment", {
      p_payload: {
        customer_id: input.customerId,
        sale_id: input.saleId ?? null,
        amount: input.amount,
        payment_method_id: input.paymentMethodId ?? null,
        note: input.note ?? "",
      },
    });
    if (error) {
      if (error.message.includes("OVERPAY")) {
        return err(new ValidationError("Nominal melebihi saldo piutang"));
      }
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const json = data as unknown as { new_balance: number | string };
    return ok({ newBalance: Math.round(Number(json.new_balance)) });
  }

  public async getPaymentHistory(
    customerId: string
  ): Promise<
    Result<
      {
        id: string;
        amount: number;
        saleId: string | null;
        methodName: string;
        note: string;
        paidAt: Date;
      }[],
      DomainError
    >
  > {
    const { data, error } = await this.client
      .from("receivable_payments")
      .select("id,amount,sale_id,note,paid_at,payment_methods ( name )")
      .eq("customer_id", customerId)
      .order("paid_at", { ascending: false })
      .limit(50);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(
      (
        (data ?? []) as unknown as {
          id: string;
          amount: number | string;
          sale_id: string | null;
          note: string;
          paid_at: string;
          payment_methods: { name: string } | null;
        }[]
      ).map((row) => ({
        id: row.id,
        amount: Math.round(Number(row.amount)),
        saleId: row.sale_id,
        methodName: row.payment_methods?.name ?? "-",
        note: row.note,
        paidAt: new Date(row.paid_at),
      }))
    );
  }
}

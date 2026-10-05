import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  CreateCustomerRecord,
  CustomerFilter,
  CustomerListResult,
  ICustomerRepository,
  UpdateCustomerRecord,
} from "@/modules/customers/domain/repositories/customer.repository";
import {
  Customer,
  type CustomerHistory,
} from "@/modules/customers/domain/entities/customer";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  points: number;
  receivable_balance: number | string;
  created_at: string;
  updated_at: string;
}

const CUSTOMER_SELECT =
  "id,name,phone,email,address,points,receivable_balance,created_at,updated_at";

function mapRow(row: CustomerRow): Customer {
  return Customer.create(
    {
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      points: row.points,
      receivableBalance: Math.round(Number(row.receivable_balance)),
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }
  );
}

function sanitizeLikeQuery(query: string): string {
  return query
    .replace(/[%_,()"']/g, "")
    .trim()
    .slice(0, 100);
}

export class SupabaseCustomerRepository implements ICustomerRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async findById(
    id: string
  ): Promise<Result<Customer | null, DomainError>> {
    const { data, error } = await this.client
      .from("customers")
      .select(CUSTOMER_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapRow(data as unknown as CustomerRow));
  }

  public async search(
    filter: CustomerFilter
  ): Promise<Result<CustomerListResult, DomainError>> {
    const page = filter.page ?? 1;
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client
      .from("customers")
      .select(CUSTOMER_SELECT, { count: "exact" })
      .is("deleted_at", null);

    const rawQuery = (filter.query ?? "").trim();
    if (rawQuery) {
      const safe = sanitizeLikeQuery(rawQuery);
      query = query.or(
        `name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`
      );
    }

    const { data, error, count } = await query.order("name").range(from, to);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok({
      items: ((data ?? []) as unknown as CustomerRow[]).map(mapRow),
      total: count ?? 0,
      page,
      pageSize,
    });
  }

  public async create(
    record: CreateCustomerRecord
  ): Promise<Result<Customer, DomainError>> {
    const { data, error } = await this.client
      .from("customers")
      .insert({
        name: record.name,
        phone: record.phone ?? "",
        email: record.email ?? "",
        address: record.address ?? "",
      })
      .select(CUSTOMER_SELECT)
      .single();
    if (error || !data) {
      return err(
        new InvariantViolationError(
          `Database error: ${error?.message ?? "unknown"}`
        )
      );
    }
    return ok(mapRow(data as unknown as CustomerRow));
  }

  public async update(
    id: string,
    patch: UpdateCustomerRecord
  ): Promise<Result<Customer, DomainError>> {
    const payload: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
    } = {};
    if (patch.name !== undefined) {
      payload.name = patch.name;
    }
    if (patch.phone !== undefined) {
      payload.phone = patch.phone;
    }
    if (patch.email !== undefined) {
      payload.email = patch.email;
    }
    if (patch.address !== undefined) {
      payload.address = patch.address;
    }
    if (Object.keys(payload).length > 0) {
      const { error } = await this.client
        .from("customers")
        .update(payload)
        .eq("id", id);
      if (error) {
        return err(
          new InvariantViolationError(`Database error: ${error.message}`)
        );
      }
    }
    const updated = await this.findById(id);
    if (!updated.success) {
      return err(updated.error);
    }
    if (updated.data === null) {
      return err(new InvariantViolationError("Pelanggan gagal dimuat"));
    }
    return ok(updated.data);
  }

  public async softDelete(id: string): Promise<Result<void, DomainError>> {
    const { error } = await this.client
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(undefined);
  }

  public async getHistory(
    customerId: string,
    limit = 20
  ): Promise<Result<CustomerHistory, DomainError>> {
    const { data, error } = await this.client
      .from("sales")
      .select("id,invoice_no,grand_total,status,created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const purchases = (
      (data ?? []) as {
        id: string;
        invoice_no: string;
        grand_total: number | string;
        status: string;
        created_at: string;
      }[]
    )
      .filter((row) => row.status !== "void" && row.status !== "held")
      .map((row) => ({
        id: row.id,
        invoiceNo: row.invoice_no,
        grandTotal: Math.round(Number(row.grand_total)),
        status: row.status,
        createdAt: new Date(row.created_at),
      }));
    const totalSpent = purchases.reduce((sum, p) => sum + p.grandTotal, 0);
    return ok({
      purchases,
      totalSpent,
      transactionCount: purchases.length,
      averagePerTransaction:
        purchases.length > 0 ? Math.round(totalSpent / purchases.length) : 0,
    });
  }
}

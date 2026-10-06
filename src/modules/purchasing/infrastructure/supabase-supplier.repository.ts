import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  CreateSupplierRecord,
  ISupplierRepository,
  UpdateSupplierRecord,
} from "@/modules/purchasing/domain/repositories/supplier.repository";
import { Supplier } from "@/modules/purchasing/domain/entities/purchasing";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  ConflictError,
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

interface SupplierRow {
  id: string;
  name: string;
  phone: string;
  address: string;
  payment_terms_days: number;
  created_at: string;
  updated_at: string;
}

const SUPPLIER_SELECT =
  "id,name,phone,address,payment_terms_days,created_at,updated_at";

function mapRow(row: SupplierRow): Supplier {
  return Supplier.create(
    {
      name: row.name,
      phone: row.phone,
      address: row.address,
      paymentTermsDays: row.payment_terms_days,
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }
  );
}

export class SupabaseSupplierRepository implements ISupplierRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async findById(
    id: string
  ): Promise<Result<Supplier | null, DomainError>> {
    const { data, error } = await this.client
      .from("suppliers")
      .select(SUPPLIER_SELECT)
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
    return ok(mapRow(data as unknown as SupplierRow));
  }

  public async findAll(): Promise<Result<Supplier[], DomainError>> {
    const { data, error } = await this.client
      .from("suppliers")
      .select(SUPPLIER_SELECT)
      .is("deleted_at", null)
      .order("name");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(((data ?? []) as unknown as SupplierRow[]).map(mapRow));
  }

  public async create(
    record: CreateSupplierRecord
  ): Promise<Result<Supplier, DomainError>> {
    const { data, error } = await this.client
      .from("suppliers")
      .insert({
        name: record.name,
        phone: record.phone ?? "",
        address: record.address ?? "",
        payment_terms_days: record.paymentTermsDays ?? 0,
      })
      .select(SUPPLIER_SELECT)
      .single();
    if (error || !data) {
      return err(
        new InvariantViolationError(
          `Database error: ${error?.message ?? "unknown"}`
        )
      );
    }
    return ok(mapRow(data as unknown as SupplierRow));
  }

  public async update(
    id: string,
    patch: UpdateSupplierRecord
  ): Promise<Result<Supplier, DomainError>> {
    const payload: {
      name?: string;
      phone?: string;
      address?: string;
      payment_terms_days?: number;
    } = {};
    if (patch.name !== undefined) {
      payload.name = patch.name;
    }
    if (patch.phone !== undefined) {
      payload.phone = patch.phone;
    }
    if (patch.address !== undefined) {
      payload.address = patch.address;
    }
    if (patch.paymentTermsDays !== undefined) {
      payload.payment_terms_days = patch.paymentTermsDays;
    }
    if (Object.keys(payload).length > 0) {
      const { error } = await this.client
        .from("suppliers")
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
      return err(new InvariantViolationError("Supplier gagal dimuat"));
    }
    return ok(updated.data);
  }

  public async remove(id: string): Promise<Result<void, DomainError>> {
    const { error } = await this.client.from("suppliers").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return err(
          new ConflictError("Supplier masih dipakai transaksi pembelian")
        );
      }
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(undefined);
  }
}

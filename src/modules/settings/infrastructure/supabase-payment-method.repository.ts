import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  CreatePaymentMethodRecord,
  IPaymentMethodRepository,
  UpdatePaymentMethodRecord,
} from "@/modules/settings/domain/repositories/payment-method.repository";
import {
  PaymentMethod,
  type PaymentMethodType,
} from "@/modules/settings/domain/entities/payment-method";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  NotFoundError,
  type DomainError,
} from "@/shared/kernel/errors";

const PAYMENT_METHOD_TYPES: PaymentMethodType[] = [
  "cash",
  "card",
  "qris",
  "transfer",
  "ewallet",
];

export class SupabasePaymentMethodRepository implements IPaymentMethodRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private async list(
    onlyActive: boolean
  ): Promise<Result<PaymentMethod[], DomainError>> {
    let query = this.client
      .from("payment_methods")
      .select("id,name,type,is_active")
      .is("deleted_at", null)
      .order("name");
    if (onlyActive) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const items = (
      (data ?? []) as {
        id: string;
        name: string;
        type: string;
        is_active: boolean;
      }[]
    )
      .filter((row) => (PAYMENT_METHOD_TYPES as string[]).includes(row.type))
      .map((row) =>
        PaymentMethod.create(
          {
            name: row.name,
            type: row.type as PaymentMethodType,
            isActive: row.is_active,
          },
          row.id
        )
      );
    return ok(items);
  }

  public async findAll(): Promise<Result<PaymentMethod[], DomainError>> {
    return this.list(false);
  }

  public async findActive(): Promise<Result<PaymentMethod[], DomainError>> {
    return this.list(true);
  }

  public async findById(
    id: string
  ): Promise<Result<PaymentMethod | null, DomainError>> {
    const { data, error } = await this.client
      .from("payment_methods")
      .select("id,name,type,is_active")
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
    const row = data as {
      id: string;
      name: string;
      type: string;
      is_active: boolean;
    };
    if (!(PAYMENT_METHOD_TYPES as string[]).includes(row.type)) {
      return err(
        new InvariantViolationError(`Tipe metode tidak dikenal: ${row.type}`)
      );
    }
    return ok(
      PaymentMethod.create(
        {
          name: row.name,
          type: row.type as PaymentMethodType,
          isActive: row.is_active,
        },
        row.id
      )
    );
  }

  public async create(
    record: CreatePaymentMethodRecord
  ): Promise<Result<PaymentMethod, DomainError>> {
    const { data, error } = await this.client
      .from("payment_methods")
      .insert({ name: record.name, type: record.type, is_active: true })
      .select("id,name,type,is_active")
      .single();
    if (error || !data) {
      return err(
        new InvariantViolationError(
          `Database error: ${error?.message ?? "unknown"}`
        )
      );
    }
    const row = data as {
      id: string;
      name: string;
      type: string;
      is_active: boolean;
    };
    const created = await this.findById(row.id);
    if (!created.success) {
      return err(created.error);
    }
    if (created.data === null) {
      return err(new NotFoundError("Metode pembayaran", row.id));
    }
    return ok(created.data);
  }

  public async update(
    id: string,
    patch: UpdatePaymentMethodRecord
  ): Promise<Result<PaymentMethod, DomainError>> {
    const payload: { name?: string; type?: string; is_active?: boolean } = {};
    if (patch.name !== undefined) {
      payload.name = patch.name;
    }
    if (patch.type !== undefined) {
      payload.type = patch.type;
    }
    if (patch.isActive !== undefined) {
      payload.is_active = patch.isActive;
    }
    if (Object.keys(payload).length > 0) {
      const { error } = await this.client
        .from("payment_methods")
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
      return err(new NotFoundError("Metode pembayaran", id));
    }
    return ok(updated.data);
  }
}

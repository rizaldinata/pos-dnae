import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  AdjustLoyaltyRecord,
  ILoyaltyRepository,
} from "@/modules/customers/domain/repositories/loyalty.repository";
import {
  LOYALTY_TRANSACTION_TYPES,
  LoyaltyTransaction,
  type LoyaltyTransactionType,
} from "@/modules/customers/domain/entities/loyalty";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";

interface LoyaltyRow {
  id: string;
  customer_id: string;
  sale_id: string | null;
  points: number | string;
  type: string;
  note: string | null;
  created_at: string;
}

function mapLoyaltyRow(row: LoyaltyRow): LoyaltyTransaction | null {
  if (!(LOYALTY_TRANSACTION_TYPES as string[]).includes(row.type)) {
    return null;
  }
  return LoyaltyTransaction.create(
    {
      customerId: row.customer_id,
      saleId: row.sale_id,
      points: Number(row.points),
      type: row.type as LoyaltyTransactionType,
      note: row.note,
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.created_at) }
  );
}

function mapAdjustError(message: string): DomainError {
  if (message.includes("CUSTOMER_NOT_FOUND")) {
    return new ValidationError("Pelanggan tidak ditemukan");
  }
  if (message.includes("INVALID_POINTS")) {
    return new ValidationError("Jumlah poin tidak valid");
  }
  if (message.includes("ADJUST_REASON_REQUIRED")) {
    return new ValidationError("Alasan penyesuaian wajib diisi");
  }
  if (message.includes("INSUFFICIENT_POINTS")) {
    return new ValidationError("Poin pelanggan tidak mencukupi");
  }
  if (message.includes("FORBIDDEN")) {
    return new ValidationError("Anda tidak memiliki hak akses untuk aksi ini");
  }
  return new InvariantViolationError(`Penyesuaian poin gagal: ${message}`);
}

export class SupabaseLoyaltyRepository implements ILoyaltyRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async listByCustomer(
    customerId: string,
    limit = 50
  ): Promise<Result<LoyaltyTransaction[], DomainError>> {
    const { data, error } = await this.client
      .from("loyalty_transactions")
      .select("id,customer_id,sale_id,points,type,note,created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(Math.max(Math.min(limit, 200), 1));
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const items = ((data ?? []) as unknown as LoyaltyRow[])
      .map(mapLoyaltyRow)
      .filter((row): row is LoyaltyTransaction => row !== null);
    return ok(items);
  }

  public async adjust(
    record: AdjustLoyaltyRecord
  ): Promise<Result<LoyaltyTransaction, DomainError>> {
    const { data, error } = await this.client.rpc("adjust_loyalty_points", {
      p_customer_id: record.customerId,
      p_points: Math.trunc(record.points),
      p_note: record.note,
    });
    if (error) {
      return err(mapAdjustError(error.message));
    }
    const json = data as unknown as {
      id: string;
      customer_id: string;
      points: number;
      type: string;
      note: string;
    };
    const created = mapLoyaltyRow({
      id: json.id,
      customer_id: json.customer_id,
      sale_id: null,
      points: json.points,
      type: json.type,
      note: json.note,
      created_at: new Date().toISOString(),
    });
    if (created === null) {
      return err(
        new InvariantViolationError("Hasil penyesuaian poin tidak dapat dibaca")
      );
    }
    return ok(created);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  CashMovementRecord,
  CloseShiftRecord,
  IShiftRepository,
  OpenShiftRecord,
  ShiftListFilter,
  ShiftListResult,
} from "@/modules/shifts/domain/repositories/shift.repository";
import type {
  CashMovement,
  Shift,
  ShiftSummary,
} from "@/modules/shifts/domain/entities/shift";
import {
  NotShiftOwnerError,
  ShiftAlreadyClosedError,
  ShiftAlreadyOpenError,
  ShiftNotFoundError,
} from "@/modules/shifts/domain/errors";
import {
  mapCashMovementRow,
  mapShiftRow,
  mapShiftSummaryJson,
  type CashMovementRow,
  type ShiftRow,
} from "@/modules/shifts/infrastructure/mappers/shift.mapper";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

const SHIFT_SELECT =
  "id,user_id,opened_at,closed_at,opening_cash,expected_cash,closing_cash,difference,status,created_at,updated_at";

function mapRpcError(message: string): DomainError {
  if (message.includes("SHIFT_ALREADY_OPEN")) {
    return new ShiftAlreadyOpenError();
  }
  if (message.includes("SHIFT_ALREADY_CLOSED")) {
    return new ShiftAlreadyClosedError();
  }
  if (message.includes("SHIFT_NOT_FOUND")) {
    return new ShiftNotFoundError();
  }
  if (message.includes("FORBIDDEN")) {
    return new NotShiftOwnerError();
  }
  return new InvariantViolationError(`Shift gagal: ${message}`);
}

export class SupabaseShiftRepository implements IShiftRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async openShift(
    record: OpenShiftRecord
  ): Promise<Result<Shift, DomainError>> {
    const { data, error } = await this.client.rpc("open_shift", {
      p_opening_cash: record.openingCash,
    });
    if (error) {
      return err(mapRpcError(error.message));
    }
    try {
      return ok(mapShiftRow(data as unknown as ShiftRow));
    } catch {
      return err(new InvariantViolationError("Shift tidak dapat dibaca"));
    }
  }

  public async getCurrentShift(
    userId: string
  ): Promise<Result<Shift | null, DomainError>> {
    const { data, error } = await this.client
      .from("shifts")
      .select(SHIFT_SELECT)
      .eq("user_id", userId)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapShiftRow(data as unknown as ShiftRow));
  }

  public async findById(
    shiftId: string
  ): Promise<Result<Shift | null, DomainError>> {
    const { data, error } = await this.client
      .from("shifts")
      .select(SHIFT_SELECT)
      .eq("id", shiftId)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapShiftRow(data as unknown as ShiftRow));
  }

  public async closeShift(
    record: CloseShiftRecord
  ): Promise<Result<ShiftSummary, DomainError>> {
    const { data, error } = await this.client.rpc("close_shift", {
      p_shift_id: record.shiftId,
      p_closing_cash: record.closingCash,
      p_note: record.note ?? undefined,
    });
    if (error) {
      return err(mapRpcError(error.message));
    }
    try {
      return ok(
        mapShiftSummaryJson(
          data as unknown as Parameters<typeof mapShiftSummaryJson>[0]
        )
      );
    } catch {
      return err(new InvariantViolationError("Rekap shift tidak dapat dibaca"));
    }
  }

  public async getSummary(
    shiftId: string
  ): Promise<Result<ShiftSummary, DomainError>> {
    const { data, error } = await this.client.rpc("shift_summary", {
      p_shift_id: shiftId,
    });
    if (error) {
      return err(mapRpcError(error.message));
    }
    try {
      return ok(
        mapShiftSummaryJson(
          data as unknown as Parameters<typeof mapShiftSummaryJson>[0]
        )
      );
    } catch {
      return err(new InvariantViolationError("Rekap shift tidak dapat dibaca"));
    }
  }

  public async addCashMovement(
    record: CashMovementRecord
  ): Promise<Result<CashMovement, DomainError>> {
    const { data, error } = await this.client
      .from("cash_movements")
      .insert({
        shift_id: record.shiftId,
        type: record.type,
        amount: record.amount,
        note: record.note ?? "",
        created_by: record.createdBy ?? null,
      })
      .select("id,shift_id,type,amount,note,created_by,created_at")
      .single();
    if (error || !data) {
      return err(mapRpcError(error?.message ?? "unknown"));
    }
    return ok(mapCashMovementRow(data as unknown as CashMovementRow));
  }

  public async listShifts(
    filter: ShiftListFilter
  ): Promise<Result<ShiftListResult, DomainError>> {
    const page = filter.page ?? 1;
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client
      .from("shifts")
      .select(SHIFT_SELECT, { count: "exact" });
    if (filter.userId) {
      query = query.eq("user_id", filter.userId);
    }
    if (filter.status) {
      query = query.eq("status", filter.status);
    }
    if (filter.from) {
      query = query.gte("opened_at", `${filter.from}T00:00:00+07:00`);
    }
    if (filter.to) {
      query = query.lte("opened_at", `${filter.to}T23:59:59.999+07:00`);
    }

    const { data, error, count } = await query
      .order("opened_at", { ascending: false })
      .range(from, to);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const items = ((data ?? []) as unknown as ShiftRow[]).map(mapShiftRow);
    return ok({ items, total: count ?? 0, page, pageSize });
  }
}

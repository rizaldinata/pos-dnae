import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type { IAuditRepository } from "@/modules/settings/domain/repositories/audit.repository";
import type {
  AuditLogEntry,
  AuditLogFilter,
  AuditLogListResult,
} from "@/modules/settings/domain/entities/audit-log";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

interface AuditRow {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}

export class SupabaseAuditRepository implements IAuditRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async list(
    filter: AuditLogFilter
  ): Promise<Result<AuditLogListResult, DomainError>> {
    const page = filter.page ?? 1;
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client
      .from("audit_logs")
      .select(
        "id,user_id,action,table_name,record_id,old_value,new_value,created_at",
        { count: "exact" }
      );

    if (filter.userId) {
      query = query.eq("user_id", filter.userId);
    }
    if (filter.action) {
      query = query.eq("action", filter.action);
    }
    if (filter.from) {
      query = query.gte("created_at", `${filter.from}T00:00:00+07:00`);
    }
    if (filter.to) {
      query = query.lte("created_at", `${filter.to}T23:59:59.999+07:00`);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }

    const rows = (data ?? []) as unknown as AuditRow[];
    const userIds = [
      ...new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id)),
    ];
    const names = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await this.client
        .from("profiles")
        .select("id,full_name")
        .in("id", userIds);
      for (const p of (profiles ?? []) as { id: string; full_name: string }[]) {
        names.set(p.id, p.full_name);
      }
    }

    const items: AuditLogEntry[] = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName:
        (row.user_id && names.get(row.user_id)) ||
        (row.user_id ? row.user_id.slice(0, 8) : "sistem"),
      action: row.action,
      tableName: row.table_name,
      recordId: row.record_id,
      oldValue: row.old_value,
      newValue: row.new_value,
      createdAt: new Date(row.created_at),
    }));

    return ok({ items, total: count ?? 0, page, pageSize });
  }

  public async listActions(): Promise<Result<string[], DomainError>> {
    const { data, error } = await this.client
      .from("audit_logs")
      .select("action")
      .limit(1000);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const actions = [
      ...new Set(((data ?? []) as { action: string }[]).map((r) => r.action)),
    ].sort();
    return ok(actions);
  }
}

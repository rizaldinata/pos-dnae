import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

export class SupabaseSettingsRepository implements ISettingsRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async getAll(): Promise<Result<Record<string, unknown>, DomainError>> {
    const { data, error } = await this.client
      .from("settings")
      .select("key,value");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const record: Record<string, unknown> = {};
    for (const row of (data ?? []) as { key: string; value: unknown }[]) {
      record[row.key] = row.value;
    }
    return ok(record);
  }

  public async get(key: string): Promise<Result<unknown, DomainError>> {
    const { data, error } = await this.client
      .from("settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok((data as { value: unknown } | null)?.value ?? null);
  }

  public async set(
    key: string,
    value: unknown
  ): Promise<Result<void, DomainError>> {
    return this.setMany({ [key]: value });
  }

  public async setMany(
    entries: Record<string, unknown>
  ): Promise<Result<void, DomainError>> {
    const rows = Object.entries(entries).map(([key, value]) => ({
      key,
      value: value as never,
    }));
    if (rows.length === 0) {
      return ok(undefined);
    }
    const { error } = await this.client
      .from("settings")
      .upsert(rows, { onConflict: "key" });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(undefined);
  }
}

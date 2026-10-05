import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export interface ISettingsRepository {
  getAll(): Promise<Result<Record<string, unknown>, DomainError>>;
  get(key: string): Promise<Result<unknown, DomainError>>;
  set(key: string, value: unknown): Promise<Result<void, DomainError>>;
  setMany(entries: Record<string, unknown>): Promise<Result<void, DomainError>>;
}

import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  AuditLogFilter,
  AuditLogListResult,
} from "@/modules/settings/domain/entities/audit-log";

export interface IAuditRepository {
  list(
    filter: AuditLogFilter
  ): Promise<Result<AuditLogListResult, DomainError>>;
  listActions(): Promise<Result<string[], DomainError>>;
}

import { z } from "zod";
import type { IAuditRepository } from "@/modules/settings/domain/repositories/audit.repository";
import type { AuditLogListResult } from "@/modules/settings/domain/entities/audit-log";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, type Result } from "@/shared/kernel/result";

export const AuditLogFilterSchema = z.object({
  userId: z.uuid({ error: "ID user tidak valid" }).nullish(),
  action: z.string().trim().max(100).nullish(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Tanggal harus format YYYY-MM-DD" })
    .nullish(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Tanggal harus format YYYY-MM-DD" })
    .nullish(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
});

export type AuditLogFilterInput = z.input<typeof AuditLogFilterSchema>;

export class ListAuditLogsUseCase {
  constructor(private readonly audit: IAuditRepository) {}

  public async execute(
    rawInput: AuditLogFilterInput
  ): Promise<Result<AuditLogListResult, DomainError>> {
    const parsed = AuditLogFilterSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return err(new ValidationError("Filter tidak valid", fieldErrors));
    }
    const result = await this.audit.list({
      userId: parsed.data.userId ?? undefined,
      action: parsed.data.action ?? undefined,
      from: parsed.data.from ?? undefined,
      to: parsed.data.to ?? undefined,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    if (isErr(result)) {
      return err(result.error);
    }
    return result;
  }
}

export class ListAuditActionsUseCase {
  constructor(private readonly audit: IAuditRepository) {}

  public async execute(): Promise<Result<string[], DomainError>> {
    return this.audit.listActions();
  }
}

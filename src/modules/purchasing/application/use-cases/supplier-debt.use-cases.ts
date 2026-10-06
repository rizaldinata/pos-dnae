import { z } from "zod";
import type {
  DebtListResult,
  ISupplierDebtRepository,
} from "@/modules/purchasing/domain/repositories/supplier-debt.repository";
import type { DebtStatus } from "@/modules/purchasing/domain/repositories/supplier-debt.repository";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export const RecordDebtPaymentSchema = z.object({
  amount: z
    .number({ error: "Nominal harus angka" })
    .positive({ error: "Nominal harus lebih dari 0" }),
  method: z.string().trim().max(30).optional().default("Tunai"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Tanggal harus format YYYY-MM-DD" })
    .nullish(),
  note: z.string().trim().max(300).optional().default(""),
});

export type RecordDebtPaymentRawInput = z.input<typeof RecordDebtPaymentSchema>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class ListSupplierDebtsUseCase {
  constructor(private readonly debts: ISupplierDebtRepository) {}

  public async execute(filter: {
    supplierId?: string;
    status?: DebtStatus;
    overdueOnly?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<
    Result<
      import("@/modules/purchasing/domain/repositories/supplier-debt.repository").DebtListResult,
      DomainError
    >
  > {
    return this.debts.listDebts({
      supplierId: filter.supplierId,
      status: filter.status,
      overdueOnly: filter.overdueOnly,
      page: filter.page ?? 1,
      pageSize: Math.min(Math.max(filter.pageSize ?? 20, 1), 100),
    });
  }
}

export class RecordSupplierPaymentUseCase {
  constructor(private readonly debts: ISupplierDebtRepository) {}

  public async execute(
    poId: string,
    rawInput: RecordDebtPaymentRawInput
  ): Promise<Result<{ remaining: number }, DomainError>> {
    const parsed = RecordDebtPaymentSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data pembayaran tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }

    const list = await this.debts.listDebts({ page: 1, pageSize: 1000 });
    if (isErr(list)) {
      return err(list.error);
    }
    const debt = list.data.items.find((d) => d.id === poId);
    if (!debt) {
      return err(new ValidationError("Hutang tidak ditemukan"));
    }
    if (Math.round(parsed.data.amount) > debt.remaining.amount) {
      return err(
        new ValidationError(
          `Nominal melebihi sisa hutang (${debt.remaining.amount.toLocaleString("id-ID")})`
        )
      );
    }

    const recorded = await this.debts.recordPayment({
      poId,
      amount: Math.round(parsed.data.amount),
      method: parsed.data.method,
      dueDate: parsed.data.dueDate ?? null,
      note: parsed.data.note,
    });
    if (isErr(recorded)) {
      return err(recorded.error);
    }
    const refreshed = await this.debts.listDebts({ page: 1, pageSize: 1000 });
    if (isErr(refreshed)) {
      return err(refreshed.error);
    }
    const current = refreshed.data.items.find((d) => d.id === poId);
    return ok({ remaining: current?.remaining.amount ?? 0 });
  }
}

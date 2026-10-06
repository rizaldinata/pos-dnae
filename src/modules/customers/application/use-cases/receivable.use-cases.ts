import { z } from "zod";
import type { ICustomerRepository } from "@/modules/customers/domain/repositories/customer.repository";
import type { CustomerReceivable } from "@/modules/customers/domain/entities/receivable";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export interface IReceivableRepository {
  listReceivables(
    query?: string
  ): Promise<Result<CustomerReceivable[], DomainError>>;
  recordPayment(input: {
    customerId: string;
    saleId?: string | null;
    amount: number;
    paymentMethodId?: string | null;
    note?: string;
  }): Promise<Result<{ newBalance: number }, DomainError>>;
  getPaymentHistory(
    customerId: string
  ): Promise<
    Result<
      {
        id: string;
        amount: number;
        saleId: string | null;
        methodName: string;
        note: string;
        paidAt: Date;
      }[],
      DomainError
    >
  >;
}

export const RecordReceivablePaymentSchema = z.object({
  amount: z
    .number({ error: "Nominal harus angka" })
    .positive({ error: "Nominal harus lebih dari 0" }),
  saleId: z.uuid({ error: "ID transaksi tidak valid" }).nullish(),
  paymentMethodId: z.uuid({ error: "ID metode tidak valid" }).nullish(),
  note: z.string().trim().max(300).optional().default(""),
});

export type RecordReceivablePaymentInput = z.input<
  typeof RecordReceivablePaymentSchema
>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class ListReceivablesUseCase {
  constructor(private readonly receivables: IReceivableRepository) {}

  public async execute(
    query?: string
  ): Promise<Result<CustomerReceivable[], DomainError>> {
    return this.receivables.listReceivables(query?.trim() || undefined);
  }
}

export class RecordReceivablePaymentUseCase {
  constructor(
    private readonly receivables: IReceivableRepository,
    private readonly customers: ICustomerRepository
  ) {}

  public async execute(
    customerId: string,
    rawInput: RecordReceivablePaymentInput
  ): Promise<Result<{ newBalance: number }, DomainError>> {
    const parsed = RecordReceivablePaymentSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data pembayaran tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await this.customers.findById(customerId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Pelanggan", customerId));
    }
    if (Math.round(parsed.data.amount) > existing.data.receivableBalance) {
      return err(
        new ValidationError(
          `Nominal melebihi saldo piutang (${existing.data.receivableBalance.toLocaleString("id-ID")})`
        )
      );
    }
    return this.receivables.recordPayment({
      customerId,
      saleId: parsed.data.saleId ?? null,
      amount: Math.round(parsed.data.amount),
      paymentMethodId: parsed.data.paymentMethodId ?? null,
      note: parsed.data.note,
    });
  }
}

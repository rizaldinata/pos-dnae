import { z } from "zod";
import type { IPaymentMethodRepository } from "@/modules/settings/domain/repositories/payment-method.repository";
import type { PaymentMethod } from "@/modules/settings/domain/entities/payment-method";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, type Result } from "@/shared/kernel/result";

export const PaymentMethodTypeSchema = z.enum(
  ["cash", "card", "qris", "transfer", "ewallet"],
  {
    error: "Tipe metode tidak valid",
  }
);

export const CreatePaymentMethodSchema = z.object({
  name: z
    .string({ error: "Nama metode wajib diisi" })
    .trim()
    .min(1, { error: "Nama metode wajib diisi" })
    .max(50, { error: "Nama maksimal 50 karakter" }),
  type: PaymentMethodTypeSchema,
});

export type CreatePaymentMethodInput = z.input<
  typeof CreatePaymentMethodSchema
>;

export const UpdatePaymentMethodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Nama metode wajib diisi" })
    .max(50)
    .optional(),
  type: PaymentMethodTypeSchema.optional(),
  isActive: z.boolean().optional(),
});

export type UpdatePaymentMethodInput = z.input<
  typeof UpdatePaymentMethodSchema
>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class CreatePaymentMethodUseCase {
  constructor(private readonly paymentMethods: IPaymentMethodRepository) {}

  public async execute(
    rawInput: CreatePaymentMethodInput
  ): Promise<Result<PaymentMethod, DomainError>> {
    const parsed = CreatePaymentMethodSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data metode bayar tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    return this.paymentMethods.create({
      name: parsed.data.name,
      type: parsed.data.type,
    });
  }
}

export class UpdatePaymentMethodUseCase {
  constructor(private readonly paymentMethods: IPaymentMethodRepository) {}

  public async execute(
    id: string,
    rawInput: UpdatePaymentMethodInput
  ): Promise<Result<PaymentMethod, DomainError>> {
    const parsed = UpdatePaymentMethodSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data metode bayar tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }

    const existing = await this.paymentMethods.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Metode pembayaran", id));
    }

    // Kasir butuh minimal 1 metode tunai aktif. Tolak penonaktifan tunai terakhir.
    if (
      parsed.data.isActive === false &&
      existing.data.isCash &&
      existing.data.isActive
    ) {
      const all = await this.paymentMethods.findAll();
      if (isErr(all)) {
        return err(all.error);
      }
      const otherActiveCash = all.data.some(
        (m) => m.id !== id && m.isCash && m.isActive
      );
      if (!otherActiveCash) {
        return err(
          new ValidationError(
            "Tidak dapat menonaktifkan satu-satunya metode tunai yang aktif"
          )
        );
      }
    }

    return this.paymentMethods.update(id, {
      name: parsed.data.name,
      type: parsed.data.type,
      isActive: parsed.data.isActive,
    });
  }
}

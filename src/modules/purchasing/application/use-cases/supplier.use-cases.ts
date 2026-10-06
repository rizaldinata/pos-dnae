import { z } from "zod";
import type { ISupplierRepository } from "@/modules/purchasing/domain/repositories/supplier.repository";
import type { Supplier } from "@/modules/purchasing/domain/entities/purchasing";
import { SupplierNotFoundError } from "@/modules/purchasing/domain/errors";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export const SupplierSchema = z.object({
  name: z
    .string({ error: "Nama supplier wajib diisi" })
    .trim()
    .min(1, { error: "Nama supplier wajib diisi" })
    .max(100, { error: "Nama maksimal 100 karakter" }),
  phone: z.string().trim().max(30).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  paymentTermsDays: z
    .number({ error: "Termin harus angka" })
    .int()
    .min(0)
    .optional()
    .default(0),
});

export type SupplierInput = z.input<typeof SupplierSchema>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class CreateSupplierUseCase {
  constructor(private readonly suppliers: ISupplierRepository) {}

  public async execute(
    rawInput: SupplierInput
  ): Promise<Result<Supplier, DomainError>> {
    const parsed = SupplierSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data supplier tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    return this.suppliers.create({
      name: parsed.data.name,
      phone: parsed.data.phone,
      address: parsed.data.address,
      paymentTermsDays: parsed.data.paymentTermsDays,
    });
  }
}

export class UpdateSupplierUseCase {
  constructor(private readonly suppliers: ISupplierRepository) {}

  public async execute(
    id: string,
    rawInput: Partial<SupplierInput>
  ): Promise<Result<Supplier, DomainError>> {
    const parsed = SupplierSchema.partial().safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data supplier tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await this.suppliers.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new SupplierNotFoundError());
    }
    return this.suppliers.update(id, {
      name: parsed.data.name,
      phone: parsed.data.phone,
      address: parsed.data.address,
      paymentTermsDays: parsed.data.paymentTermsDays,
    });
  }
}

export class DeleteSupplierUseCase {
  constructor(private readonly suppliers: ISupplierRepository) {}

  public async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.suppliers.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new SupplierNotFoundError());
    }
    const removed = await this.suppliers.remove(id);
    if (isErr(removed)) {
      return err(removed.error);
    }
    return ok(undefined);
  }
}

export class ListSuppliersUseCase {
  constructor(private readonly suppliers: ISupplierRepository) {}

  public async execute(): Promise<Result<Supplier[], DomainError>> {
    return this.suppliers.findAll();
  }
}

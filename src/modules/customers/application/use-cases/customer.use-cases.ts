import { z } from "zod";
import type { ICustomerRepository } from "@/modules/customers/domain/repositories/customer.repository";
import type {
  Customer,
  CustomerHistory,
} from "@/modules/customers/domain/entities/customer";
import type { CustomerListResult } from "@/modules/customers/domain/repositories/customer.repository";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export const CustomerSchema = z.object({
  name: z
    .string({ error: "Nama pelanggan wajib diisi" })
    .trim()
    .min(1, { error: "Nama pelanggan wajib diisi" })
    .max(100, { error: "Nama maksimal 100 karakter" }),
  phone: z
    .string()
    .trim()
    .max(30, { error: "Telepon maksimal 30 karakter" })
    .optional()
    .default(""),
  email: z
    .string()
    .trim()
    .max(100)
    .optional()
    .default("")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      error: "Format email tidak valid",
    }),
  address: z
    .string()
    .trim()
    .max(300, { error: "Alamat maksimal 300 karakter" })
    .optional()
    .default(""),
});

export type CustomerInput = z.input<typeof CustomerSchema>;

export const CustomerFilterSchema = z.object({
  query: z.string().trim().max(100).optional().default(""),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
});

export type CustomerFilterInput = z.input<typeof CustomerFilterSchema>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class CreateCustomerUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  public async execute(
    rawInput: CustomerInput
  ): Promise<Result<Customer, DomainError>> {
    const parsed = CustomerSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data pelanggan tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    return this.customers.create({
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
    });
  }
}

export class UpdateCustomerUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  public async execute(
    id: string,
    rawInput: Partial<CustomerInput>
  ): Promise<Result<Customer, DomainError>> {
    const parsed = CustomerSchema.partial().safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data pelanggan tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await this.customers.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Pelanggan", id));
    }
    return this.customers.update(id, {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      address: parsed.data.address,
    });
  }
}

export class DeleteCustomerUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  public async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.customers.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Pelanggan", id));
    }
    return this.customers.softDelete(id);
  }
}

export class GetCustomerUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  public async execute(id: string): Promise<Result<Customer, DomainError>> {
    const result = await this.customers.findById(id);
    if (isErr(result)) {
      return err(result.error);
    }
    if (result.data === null) {
      return err(new NotFoundError("Pelanggan", id));
    }
    return ok(result.data);
  }
}

export class ListCustomersUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  public async execute(
    rawInput: CustomerFilterInput
  ): Promise<Result<CustomerListResult, DomainError>> {
    const parsed = CustomerFilterSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError("Filter tidak valid", toFieldErrors(parsed.error))
      );
    }
    return this.customers.search({
      query: parsed.data.query || undefined,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  }
}

export class SearchCustomersUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  public async execute(
    query: string,
    limit = 10
  ): Promise<Result<Customer[], DomainError>> {
    const result = await this.customers.search({
      query: query.trim() || undefined,
      page: 1,
      pageSize: Math.min(Math.max(limit, 1), 20),
    });
    if (isErr(result)) {
      return err(result.error);
    }
    return ok(result.data.items);
  }
}

export class GetCustomerHistoryUseCase {
  constructor(private readonly customers: ICustomerRepository) {}

  public async execute(
    customerId: string
  ): Promise<Result<CustomerHistory, DomainError>> {
    const existing = await this.customers.findById(customerId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Pelanggan", customerId));
    }
    return this.customers.getHistory(customerId, 20);
  }
}

import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { PaymentMethod } from "@/modules/settings/domain/entities/payment-method";

export interface CreatePaymentMethodRecord {
  name: string;
  type: "cash" | "card" | "qris" | "transfer" | "ewallet";
}

export interface UpdatePaymentMethodRecord {
  name?: string;
  type?: "cash" | "card" | "qris" | "transfer" | "ewallet";
  isActive?: boolean;
}

export interface IPaymentMethodRepository {
  findAll(): Promise<Result<PaymentMethod[], DomainError>>;
  findActive(): Promise<Result<PaymentMethod[], DomainError>>;
  findById(id: string): Promise<Result<PaymentMethod | null, DomainError>>;
  create(
    record: CreatePaymentMethodRecord
  ): Promise<Result<PaymentMethod, DomainError>>;
  update(
    id: string,
    patch: UpdatePaymentMethodRecord
  ): Promise<Result<PaymentMethod, DomainError>>;
}

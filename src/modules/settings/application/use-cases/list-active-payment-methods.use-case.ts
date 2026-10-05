import type { IPaymentMethodRepository } from "@/modules/settings/domain/repositories/payment-method.repository";
import type { PaymentMethod } from "@/modules/settings/domain/entities/payment-method";
import { isErr, type Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export class ListActivePaymentMethodsUseCase {
  constructor(private readonly paymentMethods: IPaymentMethodRepository) {}

  public async execute(): Promise<Result<PaymentMethod[], DomainError>> {
    const result = await this.paymentMethods.findActive();
    if (isErr(result)) {
      return result;
    }
    return result;
  }
}

export class ListPaymentMethodsUseCase {
  constructor(private readonly paymentMethods: IPaymentMethodRepository) {}

  public async execute(): Promise<Result<PaymentMethod[], DomainError>> {
    const result = await this.paymentMethods.findAll();
    if (isErr(result)) {
      return result;
    }
    return result;
  }
}

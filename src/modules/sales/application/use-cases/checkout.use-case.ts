import type {
  ISaleRepository,
  SaleSummary,
} from "@/modules/sales/domain/repositories/sale.repository";
import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export interface CheckoutInput {
  totalAmount: number;
}

export class CheckoutUseCase {
  constructor(private readonly saleRepository: ISaleRepository) {}

  public async execute(
    input: CheckoutInput
  ): Promise<Result<SaleSummary, DomainError>> {
    return this.saleRepository.create({
      totalAmount: input.totalAmount,
    });
  }
}

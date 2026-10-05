import { z } from "zod";
import type {
  IStockMovementRepository,
  IStockRepository,
  StockCardResult,
  StockOverviewResult,
} from "@/modules/inventory/domain/repositories/stock.repository";
import type { Stock } from "@/modules/inventory/domain/entities/stock";
import type {
  RecordMovementInput,
  StockCardQueryInput,
  StockOverviewQueryInput,
} from "@/modules/inventory/application/dto/stock.dto";
import {
  RecordMovementSchema,
  StockCardQuerySchema,
  StockOverviewQuerySchema,
} from "@/modules/inventory/application/dto/stock.dto";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export function toStockFieldErrors(
  error: z.ZodError
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class GetStockUseCase {
  constructor(private readonly stocks: IStockRepository) {}

  public async execute(variantId: string): Promise<Result<Stock, DomainError>> {
    const result = await this.stocks.getByVariantId(variantId);
    if (isErr(result)) {
      return err(result.error);
    }
    if (result.data === null) {
      return err(new NotFoundError("Stok", variantId));
    }
    return ok(result.data);
  }
}

export class ListStockOverviewUseCase {
  constructor(private readonly stocks: IStockRepository) {}

  public async execute(
    rawInput: StockOverviewQueryInput
  ): Promise<Result<StockOverviewResult, DomainError>> {
    const parsed = StockOverviewQuerySchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Filter tidak valid",
          toStockFieldErrors(parsed.error)
        )
      );
    }
    return this.stocks.listOverview({
      query: parsed.data.query || undefined,
      categoryId: parsed.data.categoryId ?? undefined,
      status: parsed.data.status,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  }
}

export class GetStockCardUseCase {
  constructor(
    private readonly stocks: IStockRepository,
    private readonly movements: IStockMovementRepository
  ) {}

  public async execute(
    rawInput: StockCardQueryInput
  ): Promise<Result<StockCardResult, DomainError>> {
    const parsed = StockCardQuerySchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Filter tidak valid",
          toStockFieldErrors(parsed.error)
        )
      );
    }
    return this.movements.findByVariantId({
      variantId: parsed.data.variantId,
      type: parsed.data.type,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  }
}

export class RecordStockMovementUseCase {
  constructor(
    private readonly stocks: IStockRepository,
    private readonly movements: IStockMovementRepository
  ) {}

  public async execute(
    rawInput: RecordMovementInput
  ): Promise<Result<StockCardResult["movements"][number], DomainError>> {
    const parsed = RecordMovementSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data pergerakan tidak valid",
          toStockFieldErrors(parsed.error)
        )
      );
    }
    const stockResult = await this.stocks.getByVariantId(parsed.data.variantId);
    if (isErr(stockResult)) {
      return err(stockResult.error);
    }
    if (stockResult.data === null) {
      return err(new NotFoundError("Stok", parsed.data.variantId));
    }
    return this.movements.create({
      variantId: parsed.data.variantId,
      type: parsed.data.type,
      qtyChange: parsed.data.qtyChange,
      refType: parsed.data.refType ?? null,
      refId: parsed.data.refId ?? null,
      note: parsed.data.note,
    });
  }
}

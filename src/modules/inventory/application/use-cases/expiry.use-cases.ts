import type {
  ExpiringBatchResult,
  ExpiryStatusFilter,
  IStockRepository,
} from "@/modules/inventory/domain/repositories/stock.repository";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import { parseExpiryWarningDays } from "@/modules/inventory/domain/services/expiry-policy";
import { err, isErr, type Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export interface ExpiringBatchesQuery {
  status?: ExpiryStatusFilter;
  page?: number;
  pageSize?: number;
}

/** Jumlah batch yang sudah lewat / mendekati kedaluwarsa (badge sidebar & dasbor). */
export class GetExpiringCountUseCase {
  constructor(
    private readonly stocks: IStockRepository,
    private readonly settings: ISettingsRepository
  ) {}

  public async execute(): Promise<Result<number, DomainError>> {
    const all = await this.settings.getAll();
    if (isErr(all)) {
      return err(all.error);
    }
    return this.stocks.countExpiringBatches(parseExpiryWarningDays(all.data));
  }
}

/** Daftar item mendekati / sudah kedaluwarsa (Sub-PRD 4.1 checklist). */
export class GetExpiringBatchesUseCase {
  constructor(
    private readonly stocks: IStockRepository,
    private readonly settings: ISettingsRepository
  ) {}

  public async execute(
    input: ExpiringBatchesQuery = {}
  ): Promise<Result<ExpiringBatchResult, DomainError>> {
    const all = await this.settings.getAll();
    if (isErr(all)) {
      return err(all.error);
    }
    return this.stocks.listExpiringBatches({
      warningDays: parseExpiryWarningDays(all.data),
      status: input.status,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}

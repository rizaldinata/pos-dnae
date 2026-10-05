import { z } from "zod";
import type { IStockOpnameRepository } from "@/modules/inventory/domain/repositories/stock-opname.repository";
import type { IStockRepository } from "@/modules/inventory/domain/repositories/stock.repository";
import type {
  StockOpname,
  StockOpnameDetail,
} from "@/modules/inventory/domain/entities/stock-opname";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export const AdjustStockSchema = z.object({
  newQty: z
    .number({ error: "Stok baru harus angka" })
    .min(0, { error: "Stok baru minimal 0" }),
  reason: z
    .string({ error: "Alasan wajib diisi" })
    .trim()
    .min(1, { error: "Alasan penyesuaian wajib diisi" })
    .max(300, { error: "Alasan maksimal 300 karakter" }),
});

export type AdjustStockInput = z.input<typeof AdjustStockSchema>;

export const OpnameItemSchema = z.object({
  actualQty: z
    .number({ error: "Stok fisik harus angka" })
    .min(0, { error: "Stok fisik minimal 0" }),
});

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class AdjustStockUseCase {
  constructor(private readonly stocks: IStockRepository) {}

  public async execute(
    variantId: string,
    rawInput: AdjustStockInput
  ): Promise<Result<{ oldQty: number; newQty: number }, DomainError>> {
    const parsed = AdjustStockSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data penyesuaian tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await this.stocks.getByVariantId(variantId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Stok", variantId));
    }
    const result = await this.stocks.adjustStock({
      variantId,
      newQty: parsed.data.newQty,
      reason: parsed.data.reason,
    });
    if (isErr(result)) {
      return err(result.error);
    }
    return ok({ oldQty: result.data.oldQty, newQty: result.data.newQty });
  }
}

export class CreateOpnameUseCase {
  constructor(private readonly opnames: IStockOpnameRepository) {}

  public async execute(
    categoryId?: string | null
  ): Promise<Result<StockOpnameDetail, DomainError>> {
    return this.opnames.createOpname(categoryId ?? null);
  }
}

export class UpdateOpnameItemUseCase {
  constructor(private readonly opnames: IStockOpnameRepository) {}

  public async execute(
    opnameId: string,
    variantId: string,
    rawInput: { actualQty: number }
  ): Promise<Result<StockOpnameDetail, DomainError>> {
    const parsed = OpnameItemSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Stok fisik tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await this.opnames.findById(opnameId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Sesi opname", opnameId));
    }
    if (existing.data.opname.isFinal()) {
      return err(
        new ValidationError("Sesi opname sudah disetujui, tidak dapat diubah")
      );
    }
    return this.opnames.updateItem(opnameId, variantId, parsed.data.actualQty);
  }
}

export class ApproveOpnameUseCase {
  constructor(private readonly opnames: IStockOpnameRepository) {}

  public async execute(
    opnameId: string
  ): Promise<Result<{ adjustedItems: number }, DomainError>> {
    const existing = await this.opnames.findById(opnameId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Sesi opname", opnameId));
    }
    if (existing.data.opname.isFinal()) {
      return err(new ValidationError("Sesi opname sudah disetujui"));
    }
    return this.opnames.approveOpname(opnameId);
  }
}

export class ListOpnamesUseCase {
  constructor(private readonly opnames: IStockOpnameRepository) {}

  public async execute(): Promise<Result<StockOpname[], DomainError>> {
    return this.opnames.listOpnames();
  }
}

export class GetOpnameDetailUseCase {
  constructor(private readonly opnames: IStockOpnameRepository) {}

  public async execute(
    opnameId: string
  ): Promise<Result<StockOpnameDetail | null, DomainError>> {
    return this.opnames.findById(opnameId);
  }
}

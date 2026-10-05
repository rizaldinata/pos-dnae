import { z } from "zod";
import type {
  CreateReturnResult,
  ISaleRepository,
  ReturnListResult,
} from "@/modules/sales/domain/repositories/sale.repository";
import type { SaleReceipt } from "@/modules/sales/domain/entities/sale";
import {
  VoidPolicy,
  ReturnPolicy,
} from "@/modules/sales/domain/services/return-policy";
import { SaleNotFoundError } from "@/modules/sales/domain/errors";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, type Result } from "@/shared/kernel/result";

export const VoidSaleSchema = z.object({
  reason: z
    .string({ error: "Alasan wajib diisi" })
    .trim()
    .min(1, { error: "Alasan void wajib diisi" })
    .max(300, { error: "Alasan maksimal 300 karakter" }),
});

export const CreateReturnSchema = z.object({
  items: z
    .array(
      z.object({
        saleItemId: z.uuid({ error: "ID item tidak valid" }),
        qty: z
          .number({ error: "Qty harus angka" })
          .positive({ error: "Qty harus lebih dari 0" }),
      }),
      { error: "Item retur tidak valid" }
    )
    .min(1, { error: "Pilih minimal 1 item untuk diretur" })
    .max(100),
  refundMethodId: z.uuid({ error: "ID metode refund tidak valid" }),
  reason: z
    .string({ error: "Alasan wajib diisi" })
    .trim()
    .min(1, { error: "Alasan retur wajib diisi" })
    .max(300, { error: "Alasan maksimal 300 karakter" }),
});

export type CreateReturnInput = z.input<typeof CreateReturnSchema>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class VoidSaleUseCase {
  constructor(private readonly sales: ISaleRepository) {}

  public async execute(
    actor: { userId: string; canVoid: boolean },
    saleId: string,
    rawInput: { reason: string }
  ): Promise<Result<SaleReceipt, DomainError>> {
    const parsed = VoidSaleSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data void tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }

    const existing = await this.sales.findReceiptById(saleId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new SaleNotFoundError(saleId));
    }
    if (!VoidPolicy.canVoid(existing.data.sale.status, actor.canVoid)) {
      return err(
        new ValidationError(
          "Transaksi ini tidak dapat di-void (status atau hak akses)"
        )
      );
    }

    return this.sales.voidSale({ saleId, reason: parsed.data.reason });
  }
}

export class CreateReturnUseCase {
  constructor(private readonly sales: ISaleRepository) {}

  public async execute(
    actor: { userId: string; canReturn: boolean },
    saleId: string,
    rawInput: CreateReturnInput
  ): Promise<Result<CreateReturnResult, DomainError>> {
    const parsed = CreateReturnSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data retur tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }

    const existing = await this.sales.findReceiptById(saleId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new SaleNotFoundError(saleId));
    }
    if (!ReturnPolicy.canReturn(existing.data.sale.status, actor.canReturn)) {
      return err(
        new ValidationError(
          "Transaksi ini tidak dapat diretur (status atau hak akses)"
        )
      );
    }

    const byId = new Map(existing.data.items.map((item) => [item.id, item]));
    for (const entry of parsed.data.items) {
      const item = byId.get(entry.saleItemId);
      if (!item) {
        return err(new ValidationError("Item tidak termasuk transaksi ini"));
      }
      if (
        !ReturnPolicy.isValidReturnQty(
          item.qty,
          item.returnedQty,
          Math.floor(entry.qty)
        )
      ) {
        return err(
          new ValidationError(
            `Qty retur "${item.productName}" melebihi sisa yang dapat diretur (${item.returnableQty})`
          )
        );
      }
    }

    return this.sales.createReturn({
      saleId,
      items: parsed.data.items.map((entry) => ({
        saleItemId: entry.saleItemId,
        qty: Math.floor(entry.qty),
      })),
      refundMethodId: parsed.data.refundMethodId,
      reason: parsed.data.reason,
    });
  }
}

export class ListReturnsUseCase {
  constructor(private readonly sales: ISaleRepository) {}

  public async execute(filter: {
    page?: number;
    pageSize?: number;
  }): Promise<Result<ReturnListResult, DomainError>> {
    return this.sales.listReturns({
      page: filter.page ?? 1,
      pageSize: Math.min(Math.max(filter.pageSize ?? 20, 1), 100),
    });
  }
}

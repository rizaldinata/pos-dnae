import { z } from "zod";
import type {
  ISaleRepository,
  ResumeData,
  HeldSaleSummary,
} from "@/modules/sales/domain/repositories/sale.repository";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, type Result } from "@/shared/kernel/result";

export const MAX_HELD_PER_USER = 5;

export const HoldItemSchema = z.object({
  variantId: z.uuid({ error: "ID varian tidak valid" }),
  qty: z
    .number({ error: "Qty harus angka" })
    .positive({ error: "Qty harus lebih dari 0" }),
  discount: z
    .number({ error: "Diskon harus angka" })
    .min(0, { error: "Diskon minimal 0" })
    .optional()
    .default(0),
});

export const HoldSaleSchema = z.object({
  items: z
    .array(HoldItemSchema, { error: "Item tidak valid" })
    .min(1, { error: "Keranjang kosong, tidak dapat di-hold" })
    .max(100),
  customerId: z.uuid({ error: "ID pelanggan tidak valid" }).nullish(),
  discountTotal: z.number().min(0).optional().default(0),
  transactionDiscount: z.number().min(0).optional().default(0),
  taxTotal: z.number().min(0).optional().default(0),
  serviceFee: z.number().min(0).optional().default(0),
});

export type HoldSaleInput = z.input<typeof HoldSaleSchema>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class HoldSaleUseCase {
  constructor(private readonly sales: ISaleRepository) {}

  public async execute(
    userId: string,
    rawInput: HoldSaleInput
  ): Promise<Result<{ saleId: string; holdNo: string }, DomainError>> {
    const parsed = HoldSaleSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data hold tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }

    const existing = await this.sales.listHeldSales(userId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data.length >= MAX_HELD_PER_USER) {
      return err(
        new ValidationError(
          `Maksimal ${MAX_HELD_PER_USER} transaksi di-hold per kasir`
        )
      );
    }

    return this.sales.holdSale({
      userId,
      customerId: parsed.data.customerId ?? null,
      items: parsed.data.items.map((item) => ({
        variantId: item.variantId,
        qty: Math.floor(item.qty),
        discount: Math.round(item.discount),
      })),
      discountTotal: Math.round(parsed.data.discountTotal),
      transactionDiscount: Math.round(parsed.data.transactionDiscount),
      taxTotal: Math.round(parsed.data.taxTotal),
      serviceFee: Math.round(parsed.data.serviceFee),
    });
  }
}

export class ListHeldSalesUseCase {
  constructor(private readonly sales: ISaleRepository) {}

  public async execute(
    userId: string
  ): Promise<Result<HeldSaleSummary[], DomainError>> {
    return this.sales.listHeldSales(userId);
  }
}

export class ResumeSaleUseCase {
  constructor(private readonly sales: ISaleRepository) {}

  public async execute(
    saleId: string,
    discard = false
  ): Promise<Result<ResumeData, DomainError>> {
    return this.sales.resumeSale(saleId, discard);
  }
}

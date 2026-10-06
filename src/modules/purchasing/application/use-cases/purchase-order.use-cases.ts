import { z } from "zod";
import type { IPurchaseOrderRepository } from "@/modules/purchasing/domain/repositories/purchase-order.repository";
import type {
  GoodsReceiptInfo,
  PurchaseOrder,
  PurchaseReturnInfo,
} from "@/modules/purchasing/domain/entities/purchasing";
import {
  InvalidPOStatusError,
  PurchaseOrderNotFoundError,
} from "@/modules/purchasing/domain/errors";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const POItemSchema = z.object({
  variantId: z.uuid({ error: "ID varian tidak valid" }),
  qty: z
    .number({ error: "Qty harus angka" })
    .positive({ error: "Qty harus lebih dari 0" }),
  costPrice: z
    .number({ error: "Harga beli harus angka" })
    .min(0, { error: "Harga beli minimal 0" }),
});

export const CreatePOSchema = z.object({
  supplierId: z.uuid({ error: "Supplier tidak valid" }),
  orderDate: z
    .string()
    .regex(DATE_PATTERN, { error: "Tanggal harus format YYYY-MM-DD" })
    .optional(),
  notes: z.string().trim().max(500).optional().default(""),
  items: z
    .array(POItemSchema, { error: "Item tidak valid" })
    .min(1, { error: "PO harus memiliki minimal 1 item" })
    .max(100),
});

export type CreatePOInput = z.input<typeof CreatePOSchema>;

export const ReceiveGoodsSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.uuid({ error: "ID varian tidak valid" }),
        qty: z
          .number({ error: "Qty harus angka" })
          .positive({ error: "Qty harus lebih dari 0" }),
        costPrice: z.number({ error: "Harga beli harus angka" }).min(0),
        batchNo: z.string().trim().max(50).optional().default(""),
        expiryDate: z
          .string()
          .regex(DATE_PATTERN, { error: "Tanggal harus format YYYY-MM-DD" })
          .nullish(),
      }),
      { error: "Item penerimaan tidak valid" }
    )
    .min(1, { error: "Minimal 1 item diterima" }),
  note: z.string().trim().max(300).optional().default(""),
});

export type ReceiveGoodsInput = z.input<typeof ReceiveGoodsSchema>;

export const PurchaseReturnSchema = z.object({
  reason: z
    .string({ error: "Alasan wajib diisi" })
    .trim()
    .min(1, { error: "Alasan retur wajib diisi" })
    .max(300),
  items: z
    .array(POItemSchema, { error: "Item tidak valid" })
    .min(1, { error: "Minimal 1 item diretur" }),
});

export type PurchaseReturnInput = z.input<typeof PurchaseReturnSchema>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

async function requirePO(
  repo: IPurchaseOrderRepository,
  id: string
): Promise<Result<PurchaseOrder, DomainError>> {
  const result = await repo.findById(id);
  if (isErr(result)) {
    return err(result.error);
  }
  if (result.data === null) {
    return err(new PurchaseOrderNotFoundError());
  }
  return ok(result.data);
}

export class CreatePOUseCase {
  constructor(private readonly orders: IPurchaseOrderRepository) {}

  public async execute(
    rawInput: CreatePOInput
  ): Promise<Result<{ poId: string; poNo: string }, DomainError>> {
    const parsed = CreatePOSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError("Data PO tidak valid", toFieldErrors(parsed.error))
      );
    }
    return this.orders.create({
      supplierId: parsed.data.supplierId,
      orderDate: parsed.data.orderDate,
      notes: parsed.data.notes,
      items: parsed.data.items.map((item) => ({
        variantId: item.variantId,
        qty: item.qty,
        costPrice: Math.round(item.costPrice),
      })),
    });
  }
}

export class UpdatePOUseCase {
  constructor(private readonly orders: IPurchaseOrderRepository) {}

  public async execute(
    id: string,
    rawInput: {
      notes?: string;
      items?: { variantId: string; qty: number; costPrice: number }[];
    }
  ): Promise<Result<PurchaseOrder, DomainError>> {
    const existing = await requirePO(this.orders, id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (!existing.data.canEdit()) {
      return err(
        new InvalidPOStatusError("PO hanya dapat diubah dalam status draft")
      );
    }
    if (rawInput.items !== undefined) {
      const parsed = z.array(POItemSchema).min(1).safeParse(rawInput.items);
      if (!parsed.success) {
        return err(
          new ValidationError(
            "Item PO tidak valid",
            toFieldErrors(parsed.error)
          )
        );
      }
    }
    return this.orders.updateDraft(id, rawInput);
  }
}

export class SendPOUseCase {
  constructor(private readonly orders: IPurchaseOrderRepository) {}

  public async execute(
    id: string
  ): Promise<Result<PurchaseOrder, DomainError>> {
    const existing = await requirePO(this.orders, id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (!existing.data.canSend()) {
      return err(
        new InvalidPOStatusError("PO hanya dapat dikirim dari status draft")
      );
    }
    return this.orders.setStatus(id, "sent");
  }
}

export class CancelPOUseCase {
  constructor(private readonly orders: IPurchaseOrderRepository) {}

  public async execute(
    id: string
  ): Promise<Result<PurchaseOrder, DomainError>> {
    const existing = await requirePO(this.orders, id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (!existing.data.canCancel()) {
      return err(
        new InvalidPOStatusError(
          "PO tidak dapat dibatalkan (sudah selesai/batal atau ada barang diterima)"
        )
      );
    }
    return this.orders.setStatus(id, "cancelled");
  }
}

export class ReceiveGoodsUseCase {
  constructor(private readonly orders: IPurchaseOrderRepository) {}

  public async execute(
    poId: string,
    rawInput: ReceiveGoodsInput
  ): Promise<Result<GoodsReceiptInfo, DomainError>> {
    const parsed = ReceiveGoodsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data penerimaan tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await requirePO(this.orders, poId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (!existing.data.canReceive()) {
      return err(
        new InvalidPOStatusError("PO belum dikirim atau sudah selesai")
      );
    }
    const byVariant = new Map(
      existing.data.items.map((item) => [item.variantId, item])
    );
    for (const entry of parsed.data.items) {
      const line = byVariant.get(entry.variantId);
      if (!line) {
        return err(new ValidationError("Item tidak termasuk PO ini"));
      }
      if (entry.qty > line.remainingQty) {
        return err(
          new ValidationError(
            `Terima "${line.sku}" melebihi sisa (${line.remainingQty})`
          )
        );
      }
    }
    return this.orders.receiveGoods(
      poId,
      parsed.data.items.map((entry) => ({
        variantId: entry.variantId,
        qty: entry.qty,
        costPrice: Math.round(entry.costPrice),
        batchNo: entry.batchNo,
        expiryDate: entry.expiryDate ?? null,
      })),
      parsed.data.note
    );
  }
}

export class CreatePurchaseReturnUseCase {
  constructor(private readonly orders: IPurchaseOrderRepository) {}

  public async execute(
    supplierId: string,
    rawInput: PurchaseReturnInput
  ): Promise<Result<PurchaseReturnInfo, DomainError>> {
    const parsed = PurchaseReturnSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data retur tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    if (!supplierId) {
      return err(new ValidationError("Supplier wajib dipilih"));
    }
    return this.orders.createReturn(
      supplierId,
      parsed.data.reason,
      parsed.data.items.map((item) => ({
        variantId: item.variantId,
        qty: item.qty,
        costPrice: Math.round(item.costPrice),
      }))
    );
  }
}

export class ListPOsUseCase {
  constructor(private readonly orders: IPurchaseOrderRepository) {}

  public async execute(filter: {
    supplierId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<
    Result<
      import("@/modules/purchasing/domain/repositories/purchase-order.repository").POListResult,
      DomainError
    >
  > {
    return this.orders.list({
      supplierId: filter.supplierId,
      status: filter.status,
      page: filter.page ?? 1,
      pageSize: Math.min(Math.max(filter.pageSize ?? 20, 1), 100),
    });
  }
}

export class GetPOUseCase {
  constructor(private readonly orders: IPurchaseOrderRepository) {}

  public async execute(
    id: string
  ): Promise<Result<PurchaseOrder | null, DomainError>> {
    return this.orders.findById(id);
  }
}

export class ListReceiptsUseCase {
  constructor(private readonly orders: IPurchaseOrderRepository) {}

  public async execute(
    poId: string
  ): Promise<Result<GoodsReceiptInfo[], DomainError>> {
    return this.orders.listReceipts(poId);
  }
}

export class ListPurchaseReturnsUseCase {
  constructor(private readonly orders: IPurchaseOrderRepository) {}

  public async execute(
    supplierId?: string
  ): Promise<
    Result<
      import("@/modules/purchasing/domain/entities/purchasing").PurchaseReturnInfo[],
      DomainError
    >
  > {
    return this.orders.listReturns(supplierId);
  }
}

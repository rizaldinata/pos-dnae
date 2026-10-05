import { z } from "zod";
import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { IStockRepository } from "@/modules/inventory/domain/repositories/stock.repository";
import type { IShiftRepository } from "@/modules/shifts/domain/repositories/shift.repository";
import type {
  CreateSaleRecord,
  ISaleRepository,
} from "@/modules/sales/domain/repositories/sale.repository";
import type { SaleReceipt } from "@/modules/sales/domain/entities/sale";
import { CartItem } from "@/modules/sales/domain/entities/cart-item";
import { Discount } from "@/modules/sales/domain/value-objects/discount";
import { PricingCalculator } from "@/modules/sales/domain/entities/cart";
import { StockPolicy } from "@/modules/inventory/domain/services/stock-policy";
import type { CheckoutInput } from "@/modules/sales/application/dto/checkout.dto";
import { CheckoutSchema } from "@/modules/sales/application/dto/checkout.dto";
import {
  InsufficientStockError,
  SaleNotFoundError,
  UnderpaidError,
} from "@/modules/sales/domain/errors";
import { NoOpenShiftError } from "@/modules/shifts/domain/errors";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export function toCheckoutFieldErrors(
  error: z.ZodError
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class CheckoutUseCase {
  constructor(
    private readonly sales: ISaleRepository,
    private readonly products: IProductRepository,
    private readonly stocks: IStockRepository,
    private readonly shifts: IShiftRepository
  ) {}

  public async execute(
    actor: { userId: string; idempotencyKey?: string },
    rawInput: CheckoutInput
  ): Promise<Result<SaleReceipt, DomainError>> {
    const parsed = CheckoutSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data checkout tidak valid",
          toCheckoutFieldErrors(parsed.error)
        )
      );
    }
    const idempotencyKey =
      parsed.data.idempotencyKey ?? actor.idempotencyKey ?? crypto.randomUUID();

    // Kasir wajib memiliki shift terbuka; transaksi dicatat ke shift tersebut.
    const shiftResult = await this.shifts.getCurrentShift(actor.userId);
    if (isErr(shiftResult)) {
      return err(shiftResult.error);
    }
    if (shiftResult.data === null) {
      return err(new NoOpenShiftError());
    }
    const shiftId = shiftResult.data.id;

    // Idempotency: kembalikan struk yang sudah ada bila key dipakai ulang.
    const existing =
      await this.sales.findReceiptByIdempotencyKey(idempotencyKey);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data !== null) {
      return ok(existing.data);
    }

    // Muat varian + verifikasi harga dari database (jangan percaya klien).
    const cartItems: CartItem[] = [];
    for (const item of parsed.data.items) {
      const variantResult = await this.products.findVariantById(item.variantId);
      if (isErr(variantResult)) {
        return err(variantResult.error);
      }
      if (variantResult.data === null) {
        return err(new NotFoundError("Varian produk", item.variantId));
      }
      const { variant } = variantResult.data;

      const stockResult = await this.stocks.getByVariantId(item.variantId);
      if (isErr(stockResult)) {
        return err(stockResult.error);
      }
      const stockQty = stockResult.data?.qty ?? 0;
      if (!StockPolicy.canDeduct(stockQty, item.qty, false)) {
        return err(new InsufficientStockError(variant.sku.value));
      }

      let discount: Discount | null = null;
      if (item.discount && item.discount.value > 0) {
        try {
          discount =
            item.discount.kind === "percent"
              ? Discount.percent(item.discount.value)
              : Discount.amount(item.discount.value);
        } catch {
          return err(new ValidationError("Diskon item tidak valid"));
        }
      }

      try {
        cartItems.push(
          CartItem.create({
            variantId: variant.id,
            productId: variant.productId,
            productName: variantResult.data.productName,
            variantName: variant.variantName,
            sku: variant.sku.value,
            qty: Math.floor(item.qty),
            unitPrice: variant.sellPrice,
            costPrice: variant.costPrice,
            stockQty,
            trackStock: variant.trackStock,
            discount,
            note: "",
          })
        );
      } catch {
        return err(new ValidationError("Qty item tidak valid"));
      }
    }

    const totals = PricingCalculator.calculate(cartItems, null);
    const paidTotal = parsed.data.payments.reduce(
      (sum, p) => sum + Math.round(p.amount),
      0
    );
    if (paidTotal < totals.grandTotal) {
      return err(new UnderpaidError());
    }

    const record: CreateSaleRecord = {
      idempotencyKey,
      userId: actor.userId,
      shiftId,
      customerId: parsed.data.customerId ?? null,
      allowNegativeStock: false,
      items: cartItems.map((item) => ({
        variantId: item.variantId,
        qty: item.qty,
        discount: item.discountAmount(),
      })),
      payments: parsed.data.payments.map((p) => ({
        paymentMethodId: p.paymentMethodId,
        amount: Math.round(p.amount),
        referenceNo: p.referenceNo ?? null,
      })),
    };

    const created = await this.sales.createSale(record);
    if (isErr(created)) {
      return err(created.error);
    }
    return ok(created.data);
  }
}

export class GetSaleReceiptUseCase {
  constructor(private readonly sales: ISaleRepository) {}

  public async execute(ref: {
    id?: string;
    invoiceNo?: string;
  }): Promise<Result<SaleReceipt, DomainError>> {
    const result = ref.id
      ? await this.sales.findReceiptById(ref.id)
      : ref.invoiceNo
        ? await this.sales.findReceiptByInvoice(ref.invoiceNo)
        : null;
    if (result === null) {
      return err(new ValidationError("Referensi struk wajib diisi"));
    }
    if (isErr(result)) {
      return err(result.error);
    }
    if (result.data === null) {
      return err(new SaleNotFoundError(ref.invoiceNo ?? ref.id));
    }
    return ok(result.data);
  }
}

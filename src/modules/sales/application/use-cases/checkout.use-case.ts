import { z } from "zod";
import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { IPriceTierRepository } from "@/modules/catalog/domain/repositories/price-tier.repository";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
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
import { priceForQty } from "@/modules/catalog/domain/entities/price-tier";
import {
  TaxCalculator,
  type PricingSettings,
} from "@/modules/sales/domain/services/tax-calculator";
import { DEFAULT_PRICING_SETTINGS } from "@/modules/sales/domain/services/tax-calculator";
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
    private readonly shifts: IShiftRepository,
    private readonly priceTiers: IPriceTierRepository,
    private readonly settings: ISettingsRepository
  ) {}

  private async loadPricingSettings(): Promise<PricingSettings> {
    const result = await this.settings.getAll();
    if (isErr(result)) {
      return { ...DEFAULT_PRICING_SETTINGS };
    }
    const record = result.data;
    const mode = record["tax.mode"];
    const toNumber = (value: unknown, fallback: number): number => {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : fallback;
    };
    return {
      taxRate: toNumber(record["tax.rate"], 0),
      taxMode:
        mode === "inclusive" || mode === "exclusive" ? mode : "exclusive",
      serviceFeeRate: toNumber(record["service_fee.rate"], 0),
    };
  }

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

    const pricing = await this.loadPricingSettings();

    // Muat tier grosir sekaligus untuk semua varian.
    const variantIds = parsed.data.items.map((item) => item.variantId);
    const tiersResult = await this.priceTiers.listByVariantIds(variantIds);
    if (isErr(tiersResult)) {
      return err(tiersResult.error);
    }
    const tiersByVariant = tiersResult.data;

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
      const effectivePrice = priceForQty(
        tiersByVariant[item.variantId] ?? [],
        Math.floor(item.qty),
        variant.sellPrice
      );

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
            unitPrice: effectivePrice,
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

    let transactionDiscount: Discount | null = null;
    if (
      parsed.data.transactionDiscount &&
      parsed.data.transactionDiscount.value > 0
    ) {
      try {
        const td = parsed.data.transactionDiscount;
        transactionDiscount =
          td.kind === "percent"
            ? Discount.percent(td.value)
            : Discount.amount(td.value);
      } catch {
        return err(new ValidationError("Diskon transaksi tidak valid"));
      }
    }

    const totals = PricingCalculator.calculate(cartItems, transactionDiscount);
    const tax = TaxCalculator.calculate(
      totals.subtotal -
        totals.itemDiscountTotal -
        totals.transactionDiscountTotal,
      pricing
    );

    const paidTotal = parsed.data.payments.reduce(
      (sum, p) => sum + Math.round(p.amount),
      0
    );
    if (paidTotal < tax.grandTotal) {
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
      transactionDiscount: totals.transactionDiscountTotal,
      taxTotal: tax.taxTotal,
      serviceFee: tax.serviceTotal,
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

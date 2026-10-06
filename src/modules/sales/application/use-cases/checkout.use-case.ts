import { z } from "zod";
import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { IPriceTierRepository } from "@/modules/catalog/domain/repositories/price-tier.repository";
import type {
  IPromotionRepository,
  IVoucherRepository,
} from "@/modules/promotions/domain/repositories/promotion.repository";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import type { IStockRepository } from "@/modules/inventory/domain/repositories/stock.repository";
import type { IShiftRepository } from "@/modules/shifts/domain/repositories/shift.repository";
import type { ICustomerRepository } from "@/modules/customers/domain/repositories/customer.repository";
import type { Customer } from "@/modules/customers/domain/entities/customer";
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
import { Money } from "@/shared/lib/money";
import {
  VoucherValidator,
  voucherFailureMessage,
} from "@/modules/promotions/domain/services/voucher-validator";
import { PromotionEngine } from "@/modules/promotions/domain/services/promotion-engine";
import {
  DEFAULT_LOYALTY_SETTINGS,
  LoyaltyPolicy,
  parseLoyaltySettings,
  redeemFailureMessage,
} from "@/modules/customers/domain/services/loyalty-policy";
import {
  TaxCalculator,
  type PricingSettings,
} from "@/modules/sales/domain/services/tax-calculator";
import type { LoyaltySettings } from "@/modules/customers/domain/services/loyalty-policy";
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
    private readonly settings: ISettingsRepository,
    private readonly customers: ICustomerRepository,
    private readonly promotions: IPromotionRepository,
    private readonly vouchers: IVoucherRepository
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

  private async loadLoyaltySettings(): Promise<LoyaltySettings> {
    const result = await this.settings.getAll();
    if (isErr(result)) {
      return { ...DEFAULT_LOYALTY_SETTINGS };
    }
    return parseLoyaltySettings(result.data);
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

    // Promo otomatis dihitung server (otoritatif); client hanya preview.
    const now = new Date();
    const activePromosResult = await this.promotions.findActive();
    if (isErr(activePromosResult)) {
      return err(activePromosResult.error);
    }
    const activePromos = activePromosResult.data;

    // Muat varian + verifikasi harga dari database (jangan percaya klien).
    // is_gift dari klien diabaikan: baris gratis hanya ditentukan server
    // dari hasil evaluasi promo BOGO.
    const cartItems: CartItem[] = [];
    const variantMeta = new Map<
      string,
      { productId: string; categoryId: string | null; sku: string }
    >();
    for (const item of parsed.data.items) {
      const variantResult = await this.products.findVariantById(item.variantId);
      if (isErr(variantResult)) {
        return err(variantResult.error);
      }
      if (variantResult.data === null) {
        return err(new NotFoundError("Varian produk", item.variantId));
      }
      const { variant } = variantResult.data;
      variantMeta.set(item.variantId, {
        productId: variantResult.data.productId,
        categoryId: variantResult.data.categoryId,
        sku: variant.sku.value,
      });
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

      if (item.isGift) {
        return err(
          new ValidationError(
            "Item gratis dihitung otomatis dari promo dan tidak perlu dikirim"
          )
        );
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

    // Terapkan promo: diskon per baris = terbesar (manual vs promo),
    // lalu tambahkan baris gratis BOGO yang stoknya cukup.
    const subtotalEstimate = cartItems.reduce(
      (sum, entry) => sum + entry.grossAmount(),
      0
    );
    const engineResult = PromotionEngine.evaluate(
      cartItems.map((entry) => {
        const meta = variantMeta.get(entry.variantId);
        return {
          variantId: entry.variantId,
          productId: entry.productId,
          categoryId: meta?.categoryId ?? null,
          qty: entry.qty,
          unitPrice: entry.unitPrice.amount,
        };
      }),
      activePromos,
      now,
      subtotalEstimate
    );

    const effectiveItems: CartItem[] = [];
    const effectiveGiftFlags: boolean[] = [];
    for (const entry of cartItems) {
      const manual = entry.discountAmount();
      const promo = engineResult.lineDiscounts.get(entry.variantId) ?? 0;
      const effective = Math.max(manual, promo);
      effectiveItems.push(
        entry.withDiscount(effective > 0 ? Discount.amount(effective) : null)
      );
      effectiveGiftFlags.push(false);
    }

    for (const [giftVariantId, giftQty] of engineResult.giftLines) {
      const stockCheck = await this.stocks.getByVariantId(giftVariantId);
      if (isErr(stockCheck)) {
        return err(stockCheck.error);
      }
      const available = stockCheck.data?.qty ?? 0;
      if (available < giftQty) {
        continue;
      }
      const giftVariant = await this.products.findVariantById(giftVariantId);
      if (isErr(giftVariant)) {
        return err(giftVariant.error);
      }
      if (giftVariant.data === null) {
        continue;
      }
      try {
        effectiveItems.push(
          CartItem.create({
            variantId: giftVariantId,
            productId: giftVariant.data.productId,
            productName: giftVariant.data.productName,
            variantName: giftVariant.data.variant.variantName,
            sku: giftVariant.data.variant.sku.value,
            qty: giftQty,
            unitPrice: Money.create(0),
            costPrice: giftVariant.data.variant.costPrice,
            stockQty: available,
            trackStock: giftVariant.data.variant.trackStock,
            discount: null,
            note: "",
          })
        );
        effectiveGiftFlags.push(true);
      } catch {
        return err(new ValidationError("Item gratis tidak valid"));
      }
    }

    const appliedPromotionIds = engineResult.appliedPromotionIds;

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

    if (parsed.data.isCredit && !parsed.data.customerId) {
      return err(
        new ValidationError(
          "Penjualan kredit wajib memilih pelanggan terdaftar"
        )
      );
    }

    let customer: Customer | null = null;
    if (parsed.data.customerId) {
      const customerResult = await this.customers.findById(
        parsed.data.customerId
      );
      if (isErr(customerResult)) {
        return err(customerResult.error);
      }
      if (customerResult.data === null) {
        return err(new NotFoundError("Pelanggan", parsed.data.customerId));
      }
      customer = customerResult.data;
    }

    const totals = PricingCalculator.calculate(
      effectiveItems,
      transactionDiscount
    );

    // Voucher: validasi penuh + hitung server-side (cermin RPC).
    let voucherDiscount = 0;
    const voucherCode = parsed.data.voucherCode?.trim().toUpperCase() || null;
    if (voucherCode) {
      const voucherResult = await this.vouchers.findByCode(voucherCode);
      if (isErr(voucherResult)) {
        return err(voucherResult.error);
      }
      const voucherCheck = VoucherValidator.validate(
        voucherResult.data,
        totals.subtotal -
          totals.itemDiscountTotal -
          totals.transactionDiscountTotal,
        now
      );
      if (!voucherCheck.valid) {
        return err(
          new ValidationError(
            voucherFailureMessage(voucherCheck.reason ?? "not_found")
          )
        );
      }
      voucherDiscount = voucherCheck.discount;
    }

    // Penukaran poin (POS-14): validasi saldo & nilai poin di server; jumlah
    // poin dikirim ke RPC yang memotong saldo + mencatat riwayat atomik.
    const redeemPoints = parsed.data.redeemPoints;
    let redeemDiscount = 0;
    if (redeemPoints > 0) {
      if (customer === null) {
        return err(
          new ValidationError("Penukaran poin wajib memilih pelanggan")
        );
      }
      const loyalty = await this.loadLoyaltySettings();
      const baseAfterVoucher =
        totals.subtotal -
        totals.itemDiscountTotal -
        totals.transactionDiscountTotal -
        voucherDiscount;
      const check = LoyaltyPolicy.validateRedeem(
        customer.points,
        redeemPoints,
        baseAfterVoucher,
        loyalty
      );
      if (!check.ok) {
        return err(new ValidationError(redeemFailureMessage(check.reason)));
      }
      redeemDiscount = check.discount;
    }

    const tax = TaxCalculator.calculate(
      totals.subtotal -
        totals.itemDiscountTotal -
        totals.transactionDiscountTotal -
        voucherDiscount -
        redeemDiscount,
      pricing
    );

    const paidTotal = parsed.data.payments.reduce(
      (sum, p) => sum + Math.round(p.amount),
      0
    );
    if (!parsed.data.isCredit && paidTotal < tax.grandTotal) {
      return err(new UnderpaidError());
    }

    const record: CreateSaleRecord = {
      idempotencyKey,
      userId: actor.userId,
      shiftId,
      customerId: parsed.data.customerId ?? null,
      allowNegativeStock: false,
      isCredit: parsed.data.isCredit,
      promotionIds: appliedPromotionIds,
      voucherCode,
      redeemPoints,
      items: effectiveItems.map((item, index) => ({
        variantId: item.variantId,
        qty: item.qty,
        discount: item.discountAmount(),
        isGift: effectiveGiftFlags[index] ?? false,
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

import { CartItem } from "@/modules/sales/domain/entities/cart-item";
import { Discount } from "@/modules/sales/domain/value-objects/discount";
import { ValidationError } from "@/shared/kernel/errors";

export interface CartTotals {
  itemCount: number;
  totalQty: number;
  subtotal: number;
  itemDiscountTotal: number;
  transactionDiscountTotal: number;
  grandTotal: number;
}

export class Cart {
  private constructor(
    private readonly _items: CartItem[],
    private readonly _transactionDiscount: Discount | null
  ) {}

  public static empty(): Cart {
    return new Cart([], null);
  }

  public get items(): CartItem[] {
    return [...this._items];
  }

  public get transactionDiscount(): Discount | null {
    return this._transactionDiscount;
  }

  public isEmpty(): boolean {
    return this._items.length === 0;
  }

  public findItem(variantId: string): CartItem | null {
    return this._items.find((item) => item.variantId === variantId) ?? null;
  }

  /**
   * Tambah item; varian yang sama digabung qty-nya (bukan baris baru).
   */
  public addItem(item: CartItem): Cart {
    const existing = this.findItem(item.variantId);
    if (!existing) {
      return new Cart([...this._items, item], this._transactionDiscount);
    }
    const merged = existing.withQty(existing.qty + item.qty);
    return new Cart(
      this._items.map((i) => (i.variantId === item.variantId ? merged : i)),
      this._transactionDiscount
    );
  }

  public updateQty(variantId: string, qty: number): Cart {
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new ValidationError("Qty harus lebih dari 0");
    }
    return new Cart(
      this._items.map((i) => (i.variantId === variantId ? i.withQty(qty) : i)),
      this._transactionDiscount
    );
  }

  public removeItem(variantId: string): Cart {
    return new Cart(
      this._items.filter((i) => i.variantId !== variantId),
      this._transactionDiscount
    );
  }

  public setItemDiscount(variantId: string, discount: Discount | null): Cart {
    return new Cart(
      this._items.map((i) =>
        i.variantId === variantId ? i.withDiscount(discount) : i
      ),
      this._transactionDiscount
    );
  }

  public setTransactionDiscount(discount: Discount | null): Cart {
    return new Cart(this._items, discount);
  }

  public clear(): Cart {
    return Cart.empty();
  }

  public totals(): CartTotals {
    return PricingCalculator.calculate(this._items, this._transactionDiscount);
  }
}

export class PricingCalculator {
  public static calculate(
    items: CartItem[],
    transactionDiscount: Discount | null
  ): CartTotals {
    const subtotal = items.reduce((sum, item) => sum + item.grossAmount(), 0);
    const itemDiscountTotal = items.reduce(
      (sum, item) => sum + item.discountAmount(),
      0
    );
    const afterItemDiscount = subtotal - itemDiscountTotal;
    const transactionDiscountTotal = transactionDiscount
      ? transactionDiscount.calculate(afterItemDiscount)
      : 0;
    return {
      itemCount: items.length,
      totalQty: items.reduce((sum, item) => sum + item.qty, 0),
      subtotal,
      itemDiscountTotal,
      transactionDiscountTotal,
      grandTotal: Math.max(afterItemDiscount - transactionDiscountTotal, 0),
    };
  }
}

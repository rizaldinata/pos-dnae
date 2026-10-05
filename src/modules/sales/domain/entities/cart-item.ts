import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";
import { Discount } from "@/modules/sales/domain/value-objects/discount";
import { Money } from "@/shared/lib/money";
import { ValidationError } from "@/shared/kernel/errors";

export interface CartItemProps {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  qty: number;
  unitPrice: Money;
  costPrice: Money;
  stockQty: number | null;
  trackStock: boolean;
  discount: Discount | null;
  note: string;
}

export class CartItem extends BaseEntity<CartItemProps, string> {
  private constructor(
    props: CartItemProps,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, props.variantId, timestamps);
  }

  public static create(
    props: CartItemProps,
    timestamps?: Partial<EntityTimestamps>
  ): CartItem {
    if (!Number.isFinite(props.qty) || props.qty <= 0) {
      throw new ValidationError("Qty harus lebih dari 0");
    }
    return new CartItem({ ...props, note: props.note ?? "" }, timestamps);
  }

  public get variantId(): string {
    return this._props.variantId;
  }

  public get productId(): string {
    return this._props.productId;
  }

  public get productName(): string {
    return this._props.productName;
  }

  public get variantName(): string {
    return this._props.variantName;
  }

  public get displayName(): string {
    return this._props.variantName
      ? `${this._props.productName} — ${this._props.variantName}`
      : this._props.productName;
  }

  public get sku(): string {
    return this._props.sku;
  }

  public get qty(): number {
    return this._props.qty;
  }

  public get unitPrice(): Money {
    return this._props.unitPrice;
  }

  public get costPrice(): Money {
    return this._props.costPrice;
  }

  public get stockQty(): number | null {
    return this._props.stockQty;
  }

  public get trackStock(): boolean {
    return this._props.trackStock;
  }

  public get discount(): Discount | null {
    return this._props.discount;
  }

  public get note(): string {
    return this._props.note;
  }

  public withQty(qty: number): CartItem {
    return CartItem.create({ ...this._props, qty });
  }

  public withDiscount(discount: Discount | null): CartItem {
    return new CartItem({ ...this._props, discount });
  }

  public grossAmount(): number {
    return this._props.unitPrice.amount * this._props.qty;
  }

  public discountAmount(): number {
    if (!this._props.discount) {
      return 0;
    }
    return this._props.discount.calculate(this.grossAmount());
  }

  public netAmount(): number {
    return this.grossAmount() - this.discountAmount();
  }
}

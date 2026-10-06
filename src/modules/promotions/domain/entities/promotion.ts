import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";
import { Money } from "@/shared/lib/money";

export type PromotionType = "percent" | "amount" | "bogo";
export type PromotionScope = "all" | "category" | "product";

export interface PromotionProps {
  name: string;
  type: PromotionType;
  scope: PromotionScope;
  scopeRefId: string | null;
  value: Money;
  buyQty: number;
  getQty: number;
  minPurchase: Money;
  startAt: Date;
  endAt: Date;
  isActive: boolean;
}

export class Promotion extends BaseEntity<PromotionProps> {
  private constructor(
    props: PromotionProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: PromotionProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Promotion {
    return new Promotion(props, id, timestamps);
  }

  public get name(): string {
    return this._props.name;
  }

  public get type(): PromotionType {
    return this._props.type;
  }

  public get scope(): PromotionScope {
    return this._props.scope;
  }

  public get scopeRefId(): string | null {
    return this._props.scopeRefId;
  }

  public get value(): Money {
    return this._props.value;
  }

  public get buyQty(): number {
    return this._props.buyQty;
  }

  public get getQty(): number {
    return this._props.getQty;
  }

  public get minPurchase(): Money {
    return this._props.minPurchase;
  }

  public get startAt(): Date {
    return this._props.startAt;
  }

  public get endAt(): Date {
    return this._props.endAt;
  }

  public get isActive(): boolean {
    return this._props.isActive;
  }

  public isRunning(now: Date): boolean {
    return (
      this._props.isActive &&
      this._props.startAt <= now &&
      now <= this._props.endAt
    );
  }

  public matches(productId: string, categoryId: string | null): boolean {
    if (this._props.scope === "all") {
      return true;
    }
    if (this._props.scope === "category") {
      return categoryId !== null && categoryId === this._props.scopeRefId;
    }
    return productId === this._props.scopeRefId;
  }
}

export type VoucherType = "percent" | "amount";

export interface VoucherProps {
  code: string;
  type: VoucherType;
  value: Money;
  quota: number;
  usedCount: number;
  minPurchase: Money;
  expiresAt: Date | null;
  isActive: boolean;
}

export class Voucher extends BaseEntity<VoucherProps> {
  private constructor(
    props: VoucherProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: VoucherProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Voucher {
    return new Voucher(
      { ...props, code: props.code.trim().toUpperCase() },
      id,
      timestamps
    );
  }

  public get code(): string {
    return this._props.code;
  }

  public get type(): VoucherType {
    return this._props.type;
  }

  public get value(): Money {
    return this._props.value;
  }

  public get quota(): number {
    return this._props.quota;
  }

  public get usedCount(): number {
    return this._props.usedCount;
  }

  public get minPurchase(): Money {
    return this._props.minPurchase;
  }

  public get expiresAt(): Date | null {
    return this._props.expiresAt;
  }

  public get isActive(): boolean {
    return this._props.isActive;
  }

  public get remainingQuota(): number {
    return Math.max(this._props.quota - this._props.usedCount, 0);
  }
}

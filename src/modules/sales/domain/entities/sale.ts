import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";
import { Money } from "@/shared/lib/money";

export type SaleStatus =
  "held" | "completed" | "void" | "partial_return" | "returned" | "credit";

export interface SaleProps {
  invoiceNo: string;
  idempotencyKey: string;
  shiftId: string | null;
  userId: string;
  customerId: string | null;
  subtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  serviceFee: Money;
  rounding: Money;
  grandTotal: Money;
  paidTotal: Money;
  changeAmount: Money;
  status: SaleStatus;
  cashierName?: string;
}

export class Sale extends BaseEntity<SaleProps> {
  private constructor(
    props: SaleProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: SaleProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Sale {
    return new Sale(props, id, timestamps);
  }

  public get invoiceNo(): string {
    return this._props.invoiceNo;
  }

  public get idempotencyKey(): string {
    return this._props.idempotencyKey;
  }

  public get grandTotal(): Money {
    return this._props.grandTotal;
  }

  public get paidTotal(): Money {
    return this._props.paidTotal;
  }

  public get changeAmount(): Money {
    return this._props.changeAmount;
  }

  public get status(): SaleStatus {
    return this._props.status;
  }

  public get subtotal(): Money {
    return this._props.subtotal;
  }

  public get discountTotal(): Money {
    return this._props.discountTotal;
  }
}

export interface SaleItemProps {
  saleId: string;
  variantId: string | null;
  productName: string;
  sku: string;
  qty: number;
  unitPrice: Money;
  costPrice: Money;
  discount: Money;
  subtotal: Money;
  returnedQty?: number;
}

export class SaleItem extends BaseEntity<SaleItemProps> {
  private constructor(
    props: SaleItemProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: SaleItemProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): SaleItem {
    return new SaleItem(props, id, timestamps);
  }

  public get productName(): string {
    return this._props.productName;
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

  public get subtotal(): Money {
    return this._props.subtotal;
  }

  public get discount(): Money {
    return this._props.discount;
  }

  public get returnedQty(): number {
    return this._props.returnedQty ?? 0;
  }

  public get returnableQty(): number {
    return Math.max(this._props.qty - this.returnedQty, 0);
  }
}

export interface SalePaymentProps {
  saleId: string;
  paymentMethodId: string | null;
  paymentMethodName: string;
  paymentMethodType: string;
  amount: Money;
  referenceNo: string | null;
}

export class SalePayment extends BaseEntity<SalePaymentProps> {
  private constructor(
    props: SalePaymentProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: SalePaymentProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): SalePayment {
    return new SalePayment(props, id, timestamps);
  }

  public get paymentMethodName(): string {
    return this._props.paymentMethodName;
  }

  public get paymentMethodType(): string {
    return this._props.paymentMethodType;
  }

  public get amount(): Money {
    return this._props.amount;
  }

  public get referenceNo(): string | null {
    return this._props.referenceNo;
  }
}

export interface SaleReceipt {
  sale: Sale;
  items: SaleItem[];
  payments: SalePayment[];
}

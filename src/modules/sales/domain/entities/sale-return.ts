import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";
import { Money } from "@/shared/lib/money";

export interface SaleReturnProps {
  saleId: string;
  reason: string;
  totalRefund: Money;
  refundMethodId: string | null;
  refundMethodName?: string;
  approvedBy: string | null;
  createdBy: string | null;
}

export class SaleReturn extends BaseEntity<SaleReturnProps> {
  private constructor(
    props: SaleReturnProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: SaleReturnProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): SaleReturn {
    return new SaleReturn(props, id, timestamps);
  }

  public get saleId(): string {
    return this._props.saleId;
  }

  public get reason(): string {
    return this._props.reason;
  }

  public get totalRefund(): Money {
    return this._props.totalRefund;
  }

  public get refundMethodName(): string | undefined {
    return this._props.refundMethodName;
  }
}

export interface SaleReturnItemProps {
  returnId: string;
  saleItemId: string;
  qty: number;
  refundAmount: Money;
}

export class SaleReturnItem extends BaseEntity<SaleReturnItemProps> {
  private constructor(
    props: SaleReturnItemProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: SaleReturnItemProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): SaleReturnItem {
    return new SaleReturnItem(props, id, timestamps);
  }

  public get saleItemId(): string {
    return this._props.saleItemId;
  }

  public get qty(): number {
    return this._props.qty;
  }

  public get refundAmount(): Money {
    return this._props.refundAmount;
  }
}

export interface ReturnListItem {
  id: string;
  saleId: string;
  invoiceNo: string;
  reason: string;
  totalRefund: Money;
  refundMethodName: string;
  createdAt: Date;
}

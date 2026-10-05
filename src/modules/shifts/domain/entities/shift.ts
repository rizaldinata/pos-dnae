import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";
import { Money } from "@/shared/lib/money";

export type ShiftStatus = "open" | "closed";

export interface ShiftProps {
  userId: string;
  openedAt: Date;
  closedAt: Date | null;
  openingCash: Money;
  expectedCash: Money | null;
  closingCash: Money | null;
  difference: Money | null;
  status: ShiftStatus;
}

export class Shift extends BaseEntity<ShiftProps> {
  private constructor(
    props: ShiftProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: ShiftProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Shift {
    return new Shift(props, id, timestamps);
  }

  public get userId(): string {
    return this._props.userId;
  }

  public get openedAt(): Date {
    return this._props.openedAt;
  }

  public get closedAt(): Date | null {
    return this._props.closedAt;
  }

  public get openingCash(): Money {
    return this._props.openingCash;
  }

  public get expectedCash(): Money | null {
    return this._props.expectedCash;
  }

  public get closingCash(): Money | null {
    return this._props.closingCash;
  }

  public get difference(): Money | null {
    return this._props.difference;
  }

  public get status(): ShiftStatus {
    return this._props.status;
  }

  public isOpen(): boolean {
    return this._props.status === "open";
  }
}

export type CashMovementType = "in" | "out";

export interface CashMovementProps {
  shiftId: string;
  type: CashMovementType;
  amount: Money;
  note: string;
  createdBy: string | null;
}

export class CashMovement extends BaseEntity<CashMovementProps> {
  private constructor(props: CashMovementProps, id: string, createdAt: Date) {
    super(props, id, { createdAt, updatedAt: createdAt });
  }

  public static create(
    props: CashMovementProps,
    id: string,
    createdAt: Date
  ): CashMovement {
    return new CashMovement(props, id, createdAt);
  }

  public get shiftId(): string {
    return this._props.shiftId;
  }

  public get type(): CashMovementType {
    return this._props.type;
  }

  public get amount(): Money {
    return this._props.amount;
  }

  public get note(): string {
    return this._props.note;
  }
}

export interface ShiftMethodSummary {
  methodName: string;
  methodType: string;
  transactions: number;
  total: Money;
}

export interface ShiftSummary {
  shift: Shift;
  transactions: number;
  cashSales: Money;
  cashIn: Money;
  cashOut: Money;
  changeGiven: Money;
  refundsCash: Money;
  expectedCash: Money;
  closingCash: Money | null;
  difference: Money | null;
  byMethod: ShiftMethodSummary[];
}

import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";

export type LoyaltyTransactionType = "earn" | "redeem" | "adjust";

export const LOYALTY_TRANSACTION_TYPES: LoyaltyTransactionType[] = [
  "earn",
  "redeem",
  "adjust",
];

export interface LoyaltyTransactionProps {
  customerId: string;
  saleId: string | null;
  /** Bertanda: positif (earn/adjust), negatif (redeem). */
  points: number;
  type: LoyaltyTransactionType;
  note: string | null;
}

export class LoyaltyTransaction extends BaseEntity<LoyaltyTransactionProps> {
  private constructor(
    props: LoyaltyTransactionProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: LoyaltyTransactionProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): LoyaltyTransaction {
    return new LoyaltyTransaction(
      {
        customerId: props.customerId,
        saleId: props.saleId,
        points: Math.trunc(props.points),
        type: props.type,
        note: props.note?.trim() || null,
      },
      id,
      timestamps
    );
  }

  public get customerId(): string {
    return this._props.customerId;
  }

  public get saleId(): string | null {
    return this._props.saleId;
  }

  public get points(): number {
    return this._props.points;
  }

  public get type(): LoyaltyTransactionType {
    return this._props.type;
  }

  public get note(): string | null {
    return this._props.note;
  }
}

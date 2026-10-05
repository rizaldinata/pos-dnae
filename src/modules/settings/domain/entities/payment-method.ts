import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";

export type PaymentMethodType =
  "cash" | "card" | "qris" | "transfer" | "ewallet";

export interface PaymentMethodProps {
  name: string;
  type: PaymentMethodType;
  isActive: boolean;
}

export class PaymentMethod extends BaseEntity<PaymentMethodProps> {
  private constructor(
    props: PaymentMethodProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: PaymentMethodProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): PaymentMethod {
    return new PaymentMethod(props, id, timestamps);
  }

  public get name(): string {
    return this._props.name;
  }

  public get type(): PaymentMethodType {
    return this._props.type;
  }

  public get isActive(): boolean {
    return this._props.isActive;
  }

  public get isCash(): boolean {
    return this._props.type === "cash";
  }

  public requiresReference(): boolean {
    return this._props.type !== "cash";
  }
}

import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";

export interface CustomerProps {
  name: string;
  phone: string;
  email: string;
  address: string;
  points: number;
  receivableBalance: number;
}

export class Customer extends BaseEntity<CustomerProps> {
  private constructor(
    props: CustomerProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: CustomerProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Customer {
    return new Customer(
      {
        name: props.name.trim(),
        phone: props.phone.trim(),
        email: props.email.trim(),
        address: props.address.trim(),
        points: props.points,
        receivableBalance: props.receivableBalance,
      },
      id,
      timestamps
    );
  }

  public get name(): string {
    return this._props.name;
  }

  public get phone(): string {
    return this._props.phone;
  }

  public get email(): string {
    return this._props.email;
  }

  public get address(): string {
    return this._props.address;
  }

  public get points(): number {
    return this._props.points;
  }

  public get receivableBalance(): number {
    return this._props.receivableBalance;
  }
}

export interface CustomerPurchase {
  id: string;
  invoiceNo: string;
  grandTotal: number;
  status: string;
  createdAt: Date;
}

export interface CustomerHistory {
  purchases: CustomerPurchase[];
  totalSpent: number;
  transactionCount: number;
  averagePerTransaction: number;
}

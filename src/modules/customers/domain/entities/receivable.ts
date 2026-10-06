import { BaseEntity } from "@/shared/kernel/base-entity";
import { Money } from "@/shared/lib/money";

export interface ReceivablePaymentProps {
  customerId: string;
  saleId: string | null;
  amount: Money;
  paymentMethodId: string | null;
  paymentMethodName?: string;
  note: string;
}

export class ReceivablePayment extends BaseEntity<ReceivablePaymentProps> {
  private constructor(props: ReceivablePaymentProps, id: string, paidAt: Date) {
    super(props, id, { createdAt: paidAt, updatedAt: paidAt });
  }

  public static create(
    props: ReceivablePaymentProps,
    id: string,
    paidAt: Date
  ): ReceivablePayment {
    return new ReceivablePayment(props, id, paidAt);
  }

  public get amount(): Money {
    return this._props.amount;
  }

  public get saleId(): string | null {
    return this._props.saleId;
  }
}

export interface CustomerReceivable {
  customerId: string;
  customerName: string;
  phone: string;
  balance: Money;
  lastSaleAt: Date | null;
}

export interface RecordReceivablePaymentInput {
  customerId: string;
  saleId?: string | null;
  amount: number;
  paymentMethodId?: string | null;
  note?: string;
}

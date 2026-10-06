import { BaseEntity } from "@/shared/kernel/base-entity";
import { Money } from "@/shared/lib/money";

export interface SupplierDebtProps {
  poId: string;
  poNo: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  total: Money;
  paid: Money;
  remaining: Money;
  dueDate: string | null;
}

export class SupplierDebt extends BaseEntity<SupplierDebtProps> {
  private constructor(props: SupplierDebtProps, id: string) {
    super(props, id);
  }

  public static create(props: SupplierDebtProps, id: string): SupplierDebt {
    return new SupplierDebt(props, id);
  }

  public get poNo(): string {
    return this._props.poNo;
  }

  public get supplierName(): string {
    return this._props.supplierName;
  }

  public get total(): Money {
    return this._props.total;
  }

  public get paid(): Money {
    return this._props.paid;
  }

  public get remaining(): Money {
    return this._props.remaining;
  }

  public get dueDate(): string | null {
    return this._props.dueDate;
  }

  public get isPaid(): boolean {
    return this._props.remaining.amount <= 0;
  }

  public get isOverdue(): boolean {
    if (this.isPaid || !this._props.dueDate) {
      return false;
    }
    const today = new Date().toISOString().slice(0, 10);
    return this._props.dueDate < today;
  }
}

export interface SupplierPaymentProps {
  poId: string;
  amount: Money;
  method: string;
  paidAt: Date;
  dueDate: string | null;
  note: string;
}

export class SupplierPayment extends BaseEntity<SupplierPaymentProps> {
  private constructor(props: SupplierPaymentProps, id: string) {
    super(props, id, { createdAt: props.paidAt, updatedAt: props.paidAt });
  }

  public static create(
    props: SupplierPaymentProps,
    id: string
  ): SupplierPayment {
    return new SupplierPayment(props, id);
  }

  public get amount(): Money {
    return this._props.amount;
  }

  public get method(): string {
    return this._props.method;
  }
}

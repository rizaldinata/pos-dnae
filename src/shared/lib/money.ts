import { ValueObject } from "../kernel/value-object";
import { formatRupiah } from "./format-rupiah";

export interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  private constructor(amount: number, currency = "IDR") {
    if (!Number.isFinite(amount)) {
      throw new TypeError("Money amount must be a finite number");
    }
    // Force integer rupiah to avoid floating point precision issues
    const integerAmount = Math.round(amount);
    super({ amount: integerAmount, currency });
  }

  public static create(amount: number, currency = "IDR"): Money {
    return new Money(amount, currency);
  }

  public static zero(currency = "IDR"): Money {
    return new Money(0, currency);
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  public multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new TypeError("Multiplication factor must be a finite number");
    }
    return new Money(Math.round(this.amount * factor), this.currency);
  }

  public isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  public isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount < other.amount;
  }

  public isGreaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount >= other.amount;
  }

  public isLessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount <= other.amount;
  }

  public isZero(): boolean {
    return this.amount === 0;
  }

  public isPositive(): boolean {
    return this.amount > 0;
  }

  public isNegative(): boolean {
    return this.amount < 0;
  }

  public format(withPrefix = true): string {
    return formatRupiah(this.amount, { withPrefix });
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Cannot operate on money with different currencies: ${this.currency} vs ${other.currency}`
      );
    }
  }
}

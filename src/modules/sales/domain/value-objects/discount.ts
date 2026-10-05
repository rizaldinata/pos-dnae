import { ValueObject } from "@/shared/kernel/value-object";
import { ValidationError } from "@/shared/kernel/errors";

export type DiscountKind = "percent" | "amount";

export interface DiscountProps {
  kind: DiscountKind;
  value: number;
}

export class Discount extends ValueObject<DiscountProps> {
  private constructor(kind: DiscountKind, value: number) {
    super({ kind, value });
  }

  public static percent(value: number): Discount {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new ValidationError("Diskon persen harus antara 0 dan 100");
    }
    return new Discount("percent", value);
  }

  public static amount(value: number): Discount {
    if (!Number.isFinite(value) || value < 0) {
      throw new ValidationError("Diskon nominal minimal 0");
    }
    return new Discount("amount", Math.round(value));
  }

  public get kind(): DiscountKind {
    return this.props.kind;
  }

  public get value(): number {
    return this.props.value;
  }

  public isZero(): boolean {
    return this.props.value === 0;
  }

  /**
   * Hitung nominal diskon dari jumlah dasar, dibatasi maksimal sebesar dasar.
   */
  public calculate(baseAmount: number): number {
    if (baseAmount <= 0 || this.isZero()) {
      return 0;
    }
    const raw =
      this.props.kind === "percent"
        ? Math.round((baseAmount * this.props.value) / 100)
        : this.props.value;
    return Math.min(raw, baseAmount);
  }

  public label(): string {
    return this.props.kind === "percent"
      ? `${this.props.value}%`
      : `Rp ${this.props.value.toLocaleString("id-ID")}`;
  }
}

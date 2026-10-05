import { ValueObject } from "@/shared/kernel/value-object";
import { ValidationError } from "@/shared/kernel/errors";

const INVOICE_PATTERN = /^INV-\d{8}-\d{4,}$/;

export class InvoiceNumber extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  public static create(raw: string): InvoiceNumber {
    const value = raw.trim().toUpperCase();
    if (!INVOICE_PATTERN.test(value)) {
      throw new ValidationError(`Nomor invoice tidak valid: "${raw}"`);
    }
    return new InvoiceNumber(value);
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.value;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class IdempotencyKey extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  public static generate(): IdempotencyKey {
    return new IdempotencyKey(crypto.randomUUID());
  }

  public static from(raw: string): IdempotencyKey {
    const value = raw.trim();
    if (!UUID_PATTERN.test(value)) {
      throw new ValidationError("Idempotency key harus UUID yang valid");
    }
    return new IdempotencyKey(value);
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.value;
  }
}

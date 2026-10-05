import { ValueObject } from "@/shared/kernel/value-object";
import { ValidationError } from "@/shared/kernel/errors";

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9\-_./]*$/;

export class Sku extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  public static create(raw: string): Sku {
    const value = raw.trim().toUpperCase();
    if (value.length === 0) {
      throw new ValidationError("SKU wajib diisi");
    }
    if (value.length > 50) {
      throw new ValidationError("SKU maksimal 50 karakter");
    }
    if (!SKU_PATTERN.test(value)) {
      throw new ValidationError(
        "SKU hanya boleh berisi huruf, angka, dan karakter - _ . /"
      );
    }
    return new Sku(value);
  }

  public get value(): string {
    return this.props.value;
  }

  public toString(): string {
    return this.value;
  }
}

import { describe, expect, it } from "vitest";
import {
  ean13CheckDigit,
  isEan13,
  generateEan13,
  encodeEan13,
  encodeCode128,
  encodeBarcode,
} from "@/modules/catalog/domain/services/barcode";

describe("EAN-13 check digit", () => {
  it("menghitung check digit dengan benar", () => {
    // 400638133393 → check digit 1 (contoh klasik GS1)
    expect(ean13CheckDigit("400638133393")).toBe(1);
  });

  it("melempar error bila input bukan 12 digit", () => {
    expect(() => ean13CheckDigit("123")).toThrow();
    expect(() => ean13CheckDigit("abcdefghijkl")).toThrow();
  });
});

describe("isEan13", () => {
  it("mengembalikan true untuk EAN-13 valid", () => {
    expect(isEan13("4006381333931")).toBe(true);
  });

  it("mengembalikan false untuk check digit salah", () => {
    expect(isEan13("4006381333932")).toBe(false);
  });

  it("mengembalikan false untuk panjang bukan 13", () => {
    expect(isEan13("400638133393")).toBe(false);
    expect(isEan13("")).toBe(false);
  });
});

describe("generateEan13", () => {
  it("menghasilkan EAN-13 valid dengan prefix 2", () => {
    const value = generateEan13(() => 0.5);
    expect(value).toHaveLength(13);
    expect(value.startsWith("2")).toBe(true);
    expect(isEan13(value)).toBe(true);
  });

  it("menghasilkan nilai berbeda untuk random berbeda", () => {
    const a = generateEan13(() => 0.1);
    const b = generateEan13(() => 0.9);
    expect(a).not.toBe(b);
  });
});

describe("encodeEan13", () => {
  it("menghasilkan 95 modul", () => {
    const modules = encodeEan13("4006381333931");
    expect(modules).toHaveLength(95);
  });

  it("dimulai dan diakhiri guard 101", () => {
    const modules = encodeEan13("4006381333931");
    expect(modules.slice(0, 3)).toEqual([true, false, true]);
    expect(modules.slice(-3)).toEqual([true, false, true]);
  });

  it("melempar error untuk nilai non-EAN-13", () => {
    expect(() => encodeEan13("12345")).toThrow();
  });
});

describe("encodeCode128", () => {
  it("menghasilkan modul dengan panjang sesuai jumlah simbol", () => {
    // StartB + 2 data + checksum + stop = 5 simbol; 4×11 + 13 = 57 modul
    const modules = encodeCode128("AB");
    expect(modules).toHaveLength(57);
  });

  it("melempar error untuk string kosong", () => {
    expect(() => encodeCode128("")).toThrow();
  });
});

describe("encodeBarcode", () => {
  it("mengembalikan format ean13 untuk nilai EAN-13 valid", () => {
    const result = encodeBarcode("4006381333931");
    expect(result?.format).toBe("ean13");
  });

  it("mengembalikan format code128 untuk nilai non-EAN-13", () => {
    const result = encodeBarcode("SKU-001");
    expect(result?.format).toBe("code128");
  });

  it("mengembalikan null untuk value kosong", () => {
    expect(encodeBarcode("")).toBeNull();
    expect(encodeBarcode("   ")).toBeNull();
  });
});

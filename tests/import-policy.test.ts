import { describe, expect, it } from "vitest";
import {
  parsePrice,
  parseCount,
  locateImportHeader,
  mapImportRow,
  validateImportRows,
  productGroupKey,
  IMPORT_COLUMNS,
  type ImportContext,
  type ImportRowEntry,
} from "@/modules/catalog/domain/services/import-policy";

const EMPTY_CTX: ImportContext = {
  existingSkus: new Set(),
  existingBarcodes: new Set(),
  categoryNames: new Set(),
  brandNames: new Set(),
  unitNames: new Set(),
};

function entry(line: number, values: Record<string, string>): ImportRowEntry {
  return {
    line,
    values: {
      name: "",
      category: "",
      brand: "",
      unit: "",
      sku: "",
      barcode: "",
      variantName: "",
      costPrice: "",
      sellPrice: "",
      minStock: "",
      ...values,
    },
  };
}

describe("parsePrice", () => {
  it("menangani format Indonesia (titik sebagai pemisah ribuan)", () => {
    expect(parsePrice("15.000")).toBe(15000);
    expect(parsePrice("1.234.567")).toBe(1234567);
  });

  it("menangani format internasional (koma sebagai pemisah ribuan)", () => {
    expect(parsePrice("15,000")).toBe(15000);
    expect(parsePrice("1,234,567")).toBe(1234567);
  });

  it("menangani nilai desimal", () => {
    expect(parsePrice("12.5")).toBe(12.5);
    expect(parsePrice("12,5")).toBe(12.5);
  });

  it("mengembalikan null untuk input non-angka", () => {
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("")).toBeNull();
  });
});

describe("parseCount", () => {
  it("mengembalikan angka bulat non-negatif", () => {
    expect(parseCount("5")).toBe(5);
    expect(parseCount("0")).toBe(0);
  });

  it("mengembalikan null untuk desimal atau negatif", () => {
    expect(parseCount("1.5")).toBeNull();
    expect(parseCount("-1")).toBeNull();
  });

  it("mengembalikan null untuk string kosong", () => {
    expect(parseCount("")).toBeNull();
  });
});

describe("locateImportHeader", () => {
  const HEADER = IMPORT_COLUMNS.map((c) => c.label);

  it("menemukan baris header dan memetakan kolom", () => {
    const rows = [
      HEADER,
      ["Beras", "Makanan", "", "kg", "SKU-001", "", "", "10000", "15000", "5"],
    ];
    const located = locateImportHeader(rows);
    expect(located).not.toBeNull();
    expect(located?.dataEntries).toHaveLength(1);
    expect(located?.dataEntries[0]?.line).toBe(2);
  });

  it("menangani baris judul sebelum header", () => {
    const rows = [
      ["Judul File"],
      HEADER,
      ["Beras", "", "", "", "SKU-001", "", "", "10000", "15000", ""],
    ];
    const located = locateImportHeader(rows);
    expect(located?.dataEntries[0]?.line).toBe(3);
  });

  it("mengembalikan null bila header tidak ditemukan", () => {
    expect(
      locateImportHeader([
        ["a", "b"],
        ["1", "2"],
      ])
    ).toBeNull();
  });

  it("mengabaikan baris kosong total", () => {
    const rows = [
      HEADER,
      [],
      ["Beras", "", "", "", "SKU-001", "", "", "10000", "15000", ""],
    ];
    const located = locateImportHeader(rows);
    expect(located?.dataEntries).toHaveLength(1);
  });
});

describe("mapImportRow", () => {
  it("memetakan sel ke kolom berdasarkan indeks", () => {
    const columns = Object.fromEntries(
      IMPORT_COLUMNS.map((c, i) => [c.key, i])
    ) as Record<string, number>;
    const values = mapImportRow(columns as never, [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "1",
      "2",
      "3",
    ]);
    expect(values.name).toBe("A");
    expect(values.sku).toBe("E");
  });
});

describe("validateImportRows", () => {
  const HEADER_VALUES = {
    name: "Beras Premium",
    category: "Makanan",
    brand: "BrandX",
    unit: "kg",
    sku: "SKU-001",
    barcode: "1234567890123",
    variantName: "5kg",
    costPrice: "10000",
    sellPrice: "15000",
    minStock: "5",
  };

  it("menandai baris valid tanpa error", () => {
    const result = validateImportRows([entry(2, HEADER_VALUES)], EMPTY_CTX);
    expect(result.rows[0]?.errors).toHaveLength(0);
    expect(result.newCategories).toContain("Makanan");
  });

  it("menandai error bila SKU kosong", () => {
    const result = validateImportRows(
      [entry(2, { ...HEADER_VALUES, sku: "" })],
      EMPTY_CTX
    );
    expect(result.rows[0]?.errors).toContain("SKU wajib diisi");
  });

  it("menandai error bila SKU sudah ada di DB", () => {
    const ctx = { ...EMPTY_CTX, existingSkus: new Set(["SKU-001"]) };
    const result = validateImportRows([entry(2, HEADER_VALUES)], ctx);
    expect(
      result.rows[0]?.errors.some((e) => e.includes("sudah terdaftar"))
    ).toBe(true);
  });

  it("menandai error bila SKU duplikat di file", () => {
    const result = validateImportRows(
      [entry(2, HEADER_VALUES), entry(3, HEADER_VALUES)],
      EMPTY_CTX
    );
    expect(result.rows[1]?.errors.some((e) => e.includes("duplikat"))).toBe(
      true
    );
  });

  it("menandai error bila harga tidak valid", () => {
    const result = validateImportRows(
      [entry(2, { ...HEADER_VALUES, costPrice: "abc" })],
      EMPTY_CTX
    );
    expect(result.rows[0]?.errors).toContain("Harga modal harus angka");
  });

  it("mendeteksi master baru (kategori/brand/satuan belum ada)", () => {
    const ctx: ImportContext = {
      ...EMPTY_CTX,
      categoryNames: new Set(["minuman"]),
    };
    const result = validateImportRows([entry(2, HEADER_VALUES)], ctx);
    expect(result.newCategories).toEqual(["Makanan"]);
    expect(result.newBrands).toEqual(["BrandX"]);
    expect(result.newUnits).toEqual(["kg"]);
  });
});

describe("productGroupKey", () => {
  it("membuat kunci gabungan dari nama + master", () => {
    const key = productGroupKey({
      name: "Beras",
      category: "Makanan",
      brand: "X",
      unit: "kg",
    });
    expect(key).toContain("Beras");
    expect(key).toContain("Makanan");
  });
});

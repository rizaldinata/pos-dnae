/**
 * Aturan impor produk dari CSV/Excel (PRD-06, Sub-PRD 4.2) — murni, tanpa I/O.
 *
 * Alur: locateImportHeader → validateImportRows (preview, error per baris)
 * → konfirmasi → ImportProductUseCase (ulangi validasi + batch insert).
 */

export const IMPORT_COLUMN_KEYS = [
  "name",
  "category",
  "brand",
  "unit",
  "sku",
  "barcode",
  "variantName",
  "costPrice",
  "sellPrice",
  "minStock",
] as const;

export type ImportColumnKey = (typeof IMPORT_COLUMN_KEYS)[number];

export interface ImportColumn {
  key: ImportColumnKey;
  /** Label header pada template (case-insensitive saat dicocokkan). */
  label: string;
  required: boolean;
}

/** Kolom template impor/ekspor — urutan sama dengan file template. */
export const IMPORT_COLUMNS: readonly ImportColumn[] = [
  { key: "name", label: "nama", required: true },
  { key: "category", label: "kategori", required: false },
  { key: "brand", label: "brand", required: false },
  { key: "unit", label: "satuan", required: false },
  { key: "sku", label: "sku", required: true },
  { key: "barcode", label: "barcode", required: false },
  { key: "variantName", label: "nama varian", required: false },
  { key: "costPrice", label: "harga modal", required: true },
  { key: "sellPrice", label: "harga jual", required: true },
  { key: "minStock", label: "stok minimum", required: false },
] as const;

/** Batas baris data per file impor. */
export const MAX_IMPORT_ROWS = 1000;

export type ImportRowValues = Record<ImportColumnKey, string>;

export interface ImportRowEntry {
  /** Nomor baris di file (1-based) untuk pesan error. */
  line: number;
  values: ImportRowValues;
}

function normalizeCell(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface LocatedImportHeader {
  headerIndex: number;
  columnIndexes: Record<ImportColumnKey, number>;
  dataEntries: { line: number; cells: string[] }[];
}

/**
 * Cari baris header (harus memuat kolom "nama" dan "sku") lalu petakan kolom.
 * Mengembalikan null bila header tidak ditemukan — file di luar template.
 * Baris kosong total diabaikan; nomor baris tetap 1-based sesuai file asli
 * (baris judul di atas header tidak menggeser nomor baris data).
 */
export function locateImportHeader(
  rows: readonly string[][]
): LocatedImportHeader | null {
  let headerIndex = -1;
  let columnIndexes: Record<ImportColumnKey, number> | null = null;

  for (let i = 0; i < rows.length && headerIndex === -1; i += 1) {
    const normalized = (rows[i] ?? []).map(normalizeCell);
    const candidate: Record<ImportColumnKey, number> = {
      name: -1,
      category: -1,
      brand: -1,
      unit: -1,
      sku: -1,
      barcode: -1,
      variantName: -1,
      costPrice: -1,
      sellPrice: -1,
      minStock: -1,
    };
    for (let c = 0; c < normalized.length; c += 1) {
      const column = IMPORT_COLUMNS.find((col) => col.label === normalized[c]);
      if (column) {
        candidate[column.key] = c;
      }
    }
    if (candidate.name !== -1 && candidate.sku !== -1) {
      headerIndex = i;
      columnIndexes = candidate;
    }
  }

  if (headerIndex === -1 || columnIndexes === null) {
    return null;
  }

  const dataEntries: { line: number; cells: string[] }[] = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const cells = rows[i] ?? [];
    if (cells.every((cell) => cell.trim() === "")) {
      continue;
    }
    dataEntries.push({ line: i + 1, cells });
  }

  return { headerIndex, columnIndexes, dataEntries };
}

/** Ubah sel mentah satu baris menjadi nilai per kolom template. */
export function mapImportRow(
  columns: Record<ImportColumnKey, number>,
  cells: readonly string[]
): ImportRowValues {
  const values = {} as ImportRowValues;
  for (const key of IMPORT_COLUMN_KEYS) {
    const index = columns[key];
    values[key] =
      index >= 0 && index < cells.length ? (cells[index] ?? "") : "";
  }
  return values;
}

/**
 * Parse angka harga gaya Indonesia/Internasional.
 * "12.500" / "12,500" (ribuan) → 12500; "12.5" / "12,5" (desimal) → 12.5.
 * Karakter selain angka dan pemisah dibuang ("Rp 15.000" → 15000).
 * Mengembalikan null bila bukan angka valid.
 */
export function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^\d.,-]/g, "");
  if (cleaned === "" || !/^-?[\d.,]+$/.test(cleaned)) {
    return null;
  }
  const negative = cleaned.startsWith("-");
  const body = negative ? cleaned.slice(1) : cleaned;

  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  const lastSep = Math.max(lastDot, lastComma);
  const sep = lastSep === -1 ? "" : body[lastSep];
  let integerPart = body;
  let fraction = "";

  if (sep !== "") {
    // Pemisah ribuan bila: pemisahnya berulang (1.234.567 / 1,234,567),
    // atau muncul tepat sekali dengan 3 digit setelahnya (15.000 / 15,000).
    // Selain itu dianggap desimal (12.5 / 12,5).
    const sepChar = sep ?? "";
    const occurrences = body.split(sepChar).length - 1;
    const after = body.slice(lastSep + 1);
    const isThousands = occurrences > 1 || /^\d{3}$/.test(after);
    if (isThousands) {
      integerPart = body.replace(/[.,]/g, "");
    } else {
      integerPart = body.slice(0, lastSep).replace(/[.,]/g, "");
      fraction = after;
    }
  }

  const normalized = (integerPart || "0") + (fraction ? `.${fraction}` : "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }
  return negative ? -value : value;
}

/** Parse bilangan bulat ≥ 0 (kosong → null; pemanggil menentukan default). */
export function parseCount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  const value = parsePrice(trimmed);
  if (value === null || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

export interface ImportContext {
  /** Semua nama dalam huruf kecil (lowercase) — keanggotaan case-insensitive. */
  existingSkus: Set<string>;
  existingBarcodes: Set<string>;
  categoryNames: Set<string>;
  brandNames: Set<string>;
  unitNames: Set<string>;
}

export interface ImportRowPreview extends ImportRowEntry {
  name: string;
  category: string;
  brand: string;
  unit: string;
  sku: string;
  barcode: string;
  variantName: string;
  costPrice: number | null;
  sellPrice: number | null;
  minStock: number;
  errors: string[];
}

export interface ImportPreview {
  rows: ImportRowPreview[];
  /** Nama kategori/brand/satuan yang akan dibuat baru saat konfirmasi. */
  newCategories: string[];
  newBrands: string[];
  newUnits: string[];
}

function pushDistinct(target: Set<string>, value: string): void {
  if (value) {
    target.add(value);
  }
}

/**
 * Validasi seluruh baris impor terhadap konteks DB + duplikat dalam file.
 * Baris valid disertakan dengan errors kosong; baris bermasalah tetap
 * dikembalikan sehingga preview bisa menampilkan error per baris.
 */
export function validateImportRows(
  entries: readonly ImportRowEntry[],
  ctx: ImportContext
): ImportPreview {
  const rows: ImportRowPreview[] = [];
  const seenSkus = new Map<string, number>();
  const seenBarcodes = new Map<string, number>();
  const newCategories = new Set<string>();
  const newBrands = new Set<string>();
  const newUnits = new Set<string>();

  for (const entry of entries) {
    const raw = entry.values;
    const errors: string[] = [];

    const name = (raw.name ?? "").trim();
    if (!name) {
      errors.push("Nama produk wajib diisi");
    } else if (name.length > 200) {
      errors.push("Nama produk maksimal 200 karakter");
    }

    const category = (raw.category ?? "").trim();
    const brand = (raw.brand ?? "").trim();
    const unit = (raw.unit ?? "").trim();
    const variantName = (raw.variantName ?? "").trim();
    if (category.length > 100) {
      errors.push("Kategori maksimal 100 karakter");
    }
    if (brand.length > 100) {
      errors.push("Brand maksimal 100 karakter");
    }
    if (unit.length > 50) {
      errors.push("Satuan maksimal 50 karakter");
    }
    if (variantName.length > 100) {
      errors.push("Nama varian maksimal 100 karakter");
    }

    const sku = (raw.sku ?? "").trim().toUpperCase();
    if (!sku) {
      errors.push("SKU wajib diisi");
    } else if (sku.length > 50) {
      errors.push("SKU maksimal 50 karakter");
    } else if (ctx.existingSkus.has(sku)) {
      errors.push(`SKU "${sku}" sudah terdaftar`);
    } else if (seenSkus.has(sku)) {
      errors.push(
        `SKU "${sku}" duplikat di file ini (baris ${seenSkus.get(sku)})`
      );
    } else {
      seenSkus.set(sku, entry.line);
    }

    const barcode = (raw.barcode ?? "").trim();
    if (barcode.length > 50) {
      errors.push("Barcode maksimal 50 karakter");
    } else if (barcode) {
      if (ctx.existingBarcodes.has(barcode)) {
        errors.push(`Barcode "${barcode}" sudah terdaftar`);
      } else if (seenBarcodes.has(barcode)) {
        errors.push(
          `Barcode "${barcode}" duplikat di file ini (baris ${seenBarcodes.get(barcode)})`
        );
      } else {
        seenBarcodes.set(barcode, entry.line);
      }
    }

    const costPriceRaw = (raw.costPrice ?? "").trim();
    const sellPriceRaw = (raw.sellPrice ?? "").trim();
    const minStockRaw = (raw.minStock ?? "").trim();

    if (costPriceRaw === "") {
      errors.push("Harga modal wajib diisi");
    }
    const costPrice = costPriceRaw === "" ? null : parsePrice(costPriceRaw);
    if (costPriceRaw !== "" && costPrice === null) {
      errors.push("Harga modal harus angka");
    } else if (costPrice !== null && costPrice < 0) {
      errors.push("Harga modal minimal 0");
    }

    if (sellPriceRaw === "") {
      errors.push("Harga jual wajib diisi");
    }
    const sellPrice = sellPriceRaw === "" ? null : parsePrice(sellPriceRaw);
    if (sellPriceRaw !== "" && sellPrice === null) {
      errors.push("Harga jual harus angka");
    } else if (sellPrice !== null && sellPrice < 0) {
      errors.push("Harga jual minimal 0");
    }

    let minStock = 0;
    if (minStockRaw !== "") {
      const parsed = parseCount(minStockRaw);
      if (parsed === null) {
        errors.push("Stok minimum harus angka bulat ≥ 0");
      } else {
        minStock = parsed;
      }
    }

    rows.push({
      ...entry,
      name,
      category,
      brand,
      unit,
      sku,
      barcode,
      variantName,
      costPrice,
      sellPrice,
      minStock,
      errors,
    });
  }

  for (const row of rows) {
    if (row.errors.length > 0) {
      continue;
    }
    pushDistinct(newCategories, row.category);
    pushDistinct(newBrands, row.brand);
    pushDistinct(newUnits, row.unit);
  }

  return {
    rows,
    newCategories: [...newCategories].filter(
      (n) => !ctx.categoryNames.has(n.toLowerCase())
    ),
    newBrands: [...newBrands].filter(
      (n) => !ctx.brandNames.has(n.toLowerCase())
    ),
    newUnits: [...newUnits].filter((n) => !ctx.unitNames.has(n.toLowerCase())),
  };
}

/** Kunci pengelompokan baris menjadi satu produk (nama + master sama). */
export function productGroupKey(row: {
  name: string;
  category: string;
  brand: string;
  unit: string;
}): string {
  return [row.name, row.category, row.brand, row.unit].join("\u0000");
}

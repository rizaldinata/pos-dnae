import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { ICategoryRepository } from "@/modules/catalog/domain/repositories/category.repository";
import type { IBrandRepository } from "@/modules/catalog/domain/repositories/brand.repository";
import type { IUnitRepository } from "@/modules/catalog/domain/repositories/unit.repository";
import type { Category } from "@/modules/catalog/domain/entities/category";
import type { Brand } from "@/modules/catalog/domain/entities/brand";
import type { Unit } from "@/modules/catalog/domain/entities/unit";
import { CreateProductUseCase } from "@/modules/catalog/application/use-cases/create-product.use-case";
import {
  locateImportHeader,
  mapImportRow,
  productGroupKey,
  validateImportRows,
  MAX_IMPORT_ROWS,
  type ImportContext,
  type ImportPreview,
  type ImportRowEntry,
  type ImportRowPreview,
} from "@/modules/catalog/domain/services/import-policy";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";

function invalidFile(message: string): Result<never, DomainError> {
  return err(
    new ValidationError(message, {
      file: [message + ". Gunakan template resmi dari halaman Impor Produk."],
    })
  );
}

async function collectExistingSkus(
  products: IProductRepository,
  entries: readonly ImportRowEntry[]
): Promise<Result<Set<string>, DomainError>> {
  const queued = new Set<string>();
  const existing = new Set<string>();
  for (const entry of entries) {
    const sku = entry.values.sku.trim().toUpperCase();
    if (!sku || queued.has(sku)) {
      continue;
    }
    queued.add(sku);
    const found = await products.findBySku(sku);
    if (isErr(found)) {
      return err(found.error);
    }
    if (found.data !== null) {
      existing.add(sku);
    }
  }
  return ok(existing);
}

async function collectExistingBarcodes(
  products: IProductRepository,
  entries: readonly ImportRowEntry[]
): Promise<Result<Set<string>, DomainError>> {
  const queued = new Set<string>();
  const existing = new Set<string>();
  for (const entry of entries) {
    const barcode = entry.values.barcode.trim();
    if (!barcode || queued.has(barcode)) {
      continue;
    }
    queued.add(barcode);
    const found = await products.findByBarcode(barcode);
    if (isErr(found)) {
      return err(found.error);
    }
    if (found.data !== null) {
      existing.add(barcode);
    }
  }
  return ok(existing);
}

interface ImportMasterData {
  ctx: ImportContext;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
}

/**
 * Muat konteks validasi: SKU/barcode yang sudah terdaftar + master
 * kategori/brand/satuan (untuk deteksi "buat baru" dan resolve id).
 */
async function loadImportContext(
  products: IProductRepository,
  categories: ICategoryRepository,
  brands: IBrandRepository,
  units: IUnitRepository,
  entries: readonly ImportRowEntry[]
): Promise<Result<ImportMasterData, DomainError>> {
  const [skus, barcodes, categoryList, brandList, unitList] = await Promise.all(
    [
      collectExistingSkus(products, entries),
      collectExistingBarcodes(products, entries),
      categories.findAll(),
      brands.findAll(),
      units.findAll(),
    ]
  );
  if (isErr(skus)) return err(skus.error);
  if (isErr(barcodes)) return err(barcodes.error);
  if (isErr(categoryList)) return err(categoryList.error);
  if (isErr(brandList)) return err(brandList.error);
  if (isErr(unitList)) return err(unitList.error);

  return ok({
    ctx: {
      existingSkus: skus.data,
      existingBarcodes: barcodes.data,
      categoryNames: new Set(
        categoryList.data.map((c) => c.name.toLowerCase())
      ),
      brandNames: new Set(brandList.data.map((b) => b.name.toLowerCase())),
      unitNames: new Set(
        unitList.data.flatMap((u) =>
          [u.name, u.shortName].map((n) => n.toLowerCase())
        )
      ),
    },
    categories: categoryList.data,
    brands: brandList.data,
    units: unitList.data,
  });
}

function parseEntries(rows: string[][]): Result<ImportRowEntry[], DomainError> {
  const located = locateImportHeader(rows);
  if (!located) {
    return invalidFile(
      "Baris header dengan kolom 'nama' dan 'sku' tidak ditemukan"
    );
  }
  const entries: ImportRowEntry[] = located.dataEntries.map((row) => ({
    line: row.line,
    values: mapImportRow(located.columnIndexes, row.cells),
  }));
  if (entries.length === 0) {
    return invalidFile("File tidak berisi baris data");
  }
  if (entries.length > MAX_IMPORT_ROWS) {
    return invalidFile(`Maksimal ${MAX_IMPORT_ROWS} baris per file`);
  }
  return ok(entries);
}

/** Preview impor: validasi per baris + daftar master yang akan dibuat baru. */
export class PreviewProductImportUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly categories: ICategoryRepository,
    private readonly brands: IBrandRepository,
    private readonly units: IUnitRepository
  ) {}

  public async execute(
    rows: string[][]
  ): Promise<Result<ImportPreview, DomainError>> {
    const entries = parseEntries(rows);
    if (isErr(entries)) {
      return err(entries.error);
    }
    const master = await loadImportContext(
      this.products,
      this.categories,
      this.brands,
      this.units,
      entries.data
    );
    if (isErr(master)) {
      return err(master.error);
    }
    return ok(validateImportRows(entries.data, master.data.ctx));
  }
}

export interface ImportProductsResult {
  imported: number;
  failed: number;
  errors: { line: number; message: string }[];
}

/**
 * Konfirmasi impor: validasi ulang terhadap keadaan DB terkini, buat master
 * yang belum ada, lalu insert per grup produk (nama + kategori + brand +
 * satuan sama digabung jadi satu produk multi-varian).
 */
export class ImportProductsUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly categories: ICategoryRepository,
    private readonly brands: IBrandRepository,
    private readonly units: IUnitRepository
  ) {}

  public async execute(
    entries: ImportRowEntry[]
  ): Promise<Result<ImportProductsResult, DomainError>> {
    if (!Array.isArray(entries) || entries.length === 0) {
      return err(new ValidationError("Tidak ada baris untuk diimpor"));
    }
    if (entries.length > MAX_IMPORT_ROWS) {
      return invalidFile(`Maksimal ${MAX_IMPORT_ROWS} baris per file`);
    }

    const master = await loadImportContext(
      this.products,
      this.categories,
      this.brands,
      this.units,
      entries
    );
    if (isErr(master)) {
      return err(master.error);
    }

    const preview = validateImportRows(entries, master.data.ctx);
    const errors: ImportProductsResult["errors"] = [];
    let imported = 0;
    let failed = 0;

    for (const row of preview.rows) {
      if (row.errors.length > 0) {
        failed += 1;
        errors.push({ line: row.line, message: row.errors.join("; ") });
      }
    }

    const importable = preview.rows.filter((row) => row.errors.length === 0);
    if (importable.length === 0) {
      return ok({ imported, failed, errors: sortByLine(errors) });
    }

    // --- Resolve kategori/brand/satuan: pakai yang ada, buat bila belum ---
    const categoryIds = new Map(
      master.data.categories.map((c) => [c.name.toLowerCase(), c.id])
    );
    const brandIds = new Map(
      master.data.brands.map((b) => [b.name.toLowerCase(), b.id])
    );
    const unitIds = new Map(
      master.data.units.map((u) => [u.name.toLowerCase(), u.id])
    );
    const masterFailure = new Map<string, string>();

    const distinct = (values: string[]) => [
      ...new Set(values.filter((v) => v)),
    ];

    for (const name of distinct(importable.map((r) => r.category))) {
      const key = name.toLowerCase();
      if (categoryIds.has(key)) continue;
      const created = await this.categories.create(name, null);
      if (isErr(created)) {
        masterFailure.set(`category:${key}`, created.error.message);
      } else {
        categoryIds.set(key, created.data.id);
      }
    }
    for (const name of distinct(importable.map((r) => r.brand))) {
      const key = name.toLowerCase();
      if (brandIds.has(key)) continue;
      const created = await this.brands.create(name);
      if (isErr(created)) {
        masterFailure.set(`brand:${key}`, created.error.message);
      } else {
        brandIds.set(key, created.data.id);
      }
    }
    for (const name of distinct(importable.map((r) => r.unit))) {
      const key = name.toLowerCase();
      if (unitIds.has(key)) continue;
      const created = await this.units.create(
        name,
        name.length <= 10 ? name : name.slice(0, 10)
      );
      if (isErr(created)) {
        masterFailure.set(`unit:${key}`, created.error.message);
      } else {
        unitIds.set(key, created.data.id);
      }
    }

    // --- Kelompokkan per produk lalu insert ---
    const groups = new Map<string, ImportRowPreview[]>();
    for (const row of importable) {
      const key = productGroupKey(row);
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push(row);
      } else {
        groups.set(key, [row]);
      }
    }

    for (const group of groups.values()) {
      const first = group[0];
      if (!first) {
        continue;
      }
      const failure =
        masterFailure.get(`category:${first.category.toLowerCase()}`) ??
        masterFailure.get(`brand:${first.brand.toLowerCase()}`) ??
        masterFailure.get(`unit:${first.unit.toLowerCase()}`);

      if (failure) {
        failed += group.length;
        for (const row of group) {
          errors.push({ line: row.line, message: failure });
        }
        continue;
      }

      const created = await new CreateProductUseCase(this.products).execute({
        name: first.name,
        categoryId: categoryIds.get(first.category.toLowerCase()) ?? null,
        brandId: brandIds.get(first.brand.toLowerCase()) ?? null,
        unitId: unitIds.get(first.unit.toLowerCase()) ?? null,
        variants: group.map((row) => ({
          sku: row.sku,
          barcode: row.barcode || null,
          variantName: row.variantName,
          costPrice: row.costPrice ?? 0,
          sellPrice: row.sellPrice ?? 0,
          minStock: row.minStock,
        })),
      });

      if (isErr(created)) {
        failed += group.length;
        for (const row of group) {
          errors.push({ line: row.line, message: created.error.message });
        }
      } else {
        imported += group.length;
      }
    }

    return ok({ imported, failed, errors: sortByLine(errors) });
  }
}

function sortByLine(
  errors: ImportProductsResult["errors"]
): ImportProductsResult["errors"] {
  return [...errors].sort((a, b) => a.line - b.line);
}

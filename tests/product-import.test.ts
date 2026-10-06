import { describe, expect, it } from "vitest";
import {
  PreviewProductImportUseCase,
  ImportProductsUseCase,
} from "@/modules/catalog/application/use-cases/product-import.use-cases";
import type { IProductRepository } from "@/modules/catalog/domain/repositories/product.repository";
import type { ICategoryRepository } from "@/modules/catalog/domain/repositories/category.repository";
import type { IBrandRepository } from "@/modules/catalog/domain/repositories/brand.repository";
import type { IUnitRepository } from "@/modules/catalog/domain/repositories/unit.repository";
import type { Product } from "@/modules/catalog/domain/entities/product";
import { isErr, ok } from "@/shared/kernel/result";
import { err } from "@/shared/kernel/result";
import { InvariantViolationError } from "@/shared/kernel/errors";
import {
  IMPORT_COLUMN_KEYS,
  type ImportRowValues,
} from "@/modules/catalog/domain/services/import-policy";

const HEADER = [
  "nama",
  "kategori",
  "brand",
  "satuan",
  "sku",
  "barcode",
  "nama varian",
  "harga modal",
  "harga jual",
  "stok minimum",
];

const DATA_ROW = [
  "Beras Premium",
  "Makanan",
  "BrandX",
  "kg",
  "SKU-001",
  "1234567890123",
  "5kg",
  "10000",
  "15000",
  "5",
];

/** Nilai per kolom impor untuk satu baris data (key = ImportColumnKey). */
const DATA_VALUES = Object.fromEntries(
  IMPORT_COLUMN_KEYS.map((key, i) => [key, DATA_ROW[i] ?? ""])
) as ImportRowValues;

function entry(line: number, values: ImportRowValues) {
  return { line, values };
}

function mockProductRepo(options?: {
  existingSkus?: Set<string>;
  existingBarcodes?: Set<string>;
  createError?: boolean;
}): {
  repository: IProductRepository;
  created: () => { name: string; variants: unknown[] } | null;
} {
  let created: { name: string; variants: unknown[] } | null = null;
  const repository = {
    findBySku: async (sku: string) =>
      options?.existingSkus?.has(sku) ? ok({ id: "p1" } as Product) : ok(null),
    findByBarcode: async (barcode: string) =>
      options?.existingBarcodes?.has(barcode)
        ? ok({ id: "p1" } as Product)
        : ok(null),
    create: async (input: { name: string; variants: unknown[] }) => {
      if (options?.createError) {
        return err(new InvariantViolationError("Database error"));
      }
      created = input;
      return ok({ id: "new-product" } as Product);
    },
  } as unknown as IProductRepository;
  return { repository, created: () => created };
}

function mockCategoryRepo(createdNames?: string[]): ICategoryRepository {
  const names = createdNames ?? [];
  let counter = 0;
  const nextId = () =>
    `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  return {
    findAll: async () =>
      ok(names.map((n) => ({ id: nextId(), name: n })) as never),
    create: async (name: string) => ok({ id: nextId(), name } as never),
  } as unknown as ICategoryRepository;
}

function mockBrandRepo(): IBrandRepository {
  let counter = 100;
  return {
    findAll: async () => ok([]),
    create: async (name: string) =>
      ok({
        id: `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`,
        name,
      } as never),
  } as unknown as IBrandRepository;
}

function mockUnitRepo(): IUnitRepository {
  let counter = 200;
  return {
    findAll: async () => ok([]),
    create: async (name: string, shortName: string) =>
      ok({
        id: `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`,
        name,
        shortName,
      } as never),
  } as unknown as IUnitRepository;
}

describe("PreviewProductImportUseCase", () => {
  it("mengembalikan preview baris valid", async () => {
    const { repository } = mockProductRepo();
    const useCase = new PreviewProductImportUseCase(
      repository,
      mockCategoryRepo(),
      mockBrandRepo(),
      mockUnitRepo()
    );
    const result = await useCase.execute([HEADER, DATA_ROW]);
    expect(isErr(result)).toBe(false);
    if (!isErr(result)) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]?.errors).toHaveLength(0);
    }
  });

  it("mengembalikan error bila header tidak ditemukan", async () => {
    const { repository } = mockProductRepo();
    const useCase = new PreviewProductImportUseCase(
      repository,
      mockCategoryRepo(),
      mockBrandRepo(),
      mockUnitRepo()
    );
    const result = await useCase.execute([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(isErr(result)).toBe(true);
  });
});

describe("ImportProductsUseCase", () => {
  it("mengimpor baris valid dan mengembalikan jumlah berhasil", async () => {
    const { repository, created } = mockProductRepo();
    const useCase = new ImportProductsUseCase(
      repository,
      mockCategoryRepo(),
      mockBrandRepo(),
      mockUnitRepo()
    );
    const result = await useCase.execute([entry(2, DATA_VALUES)]);
    expect(isErr(result)).toBe(false);
    if (!isErr(result)) {
      expect(result.data.imported).toBe(1);
      expect(result.data.failed).toBe(0);
    }
    expect(created()?.name).toBe("Beras Premium");
  });

  it("menghitung baris gagal bila SKU sudah ada di DB", async () => {
    const { repository } = mockProductRepo({
      existingSkus: new Set(["SKU-001"]),
    });
    const useCase = new ImportProductsUseCase(
      repository,
      mockCategoryRepo(),
      mockBrandRepo(),
      mockUnitRepo()
    );
    const result = await useCase.execute([entry(2, DATA_VALUES)]);
    expect(isErr(result)).toBe(false);
    if (!isErr(result)) {
      expect(result.data.imported).toBe(0);
      expect(result.data.failed).toBe(1);
      expect(result.data.errors[0]?.line).toBe(2);
    }
  });
});

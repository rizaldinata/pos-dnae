import { describe, expect, it } from "vitest";
import {
  BUNDLE_ITEM_MAX_QTY,
  computeBundleStockQty,
  validateBundleItems,
} from "@/modules/catalog/domain/services/bundle-policy";
import {
  GetBundleItemsUseCase,
  SaveBundleItemsUseCase,
} from "@/modules/catalog/application/use-cases/bundle.use-cases";
import type {
  BundleComponent,
  BundleItemInput,
  ComponentInfo,
  IBundleRepository,
} from "@/modules/catalog/domain/repositories/bundle.repository";
import {
  InvariantViolationError,
  NotFoundError,
  ValidationError,
} from "@/shared/kernel/errors";
import { err, ok } from "@/shared/kernel/result";

const PRODUCT_ID = "10000000-0000-4000-8000-000000000010";
const OTHER_PRODUCT_ID = "10000000-0000-4000-8000-000000000011";
const COMPONENT_ID = "10000000-0000-4000-8000-000000000012";

function info(
  overrides?: Partial<ComponentInfo> & { productId?: string }
): ComponentInfo {
  return {
    productId: overrides?.productId ?? OTHER_PRODUCT_ID,
    productName: overrides?.productName ?? "Beras",
    variantName: overrides?.variantName ?? "",
    sku: overrides?.sku ?? "BRS-5KG",
    isBundle: overrides?.isBundle ?? false,
  };
}

function bundleRepo(options?: {
  describe?: Record<string, ComponentInfo>;
  list?: BundleComponent[];
  describeError?: boolean;
  replaceError?: boolean;
}): {
  repository: IBundleRepository;
  replaced: () => { productId: string; items: BundleItemInput[] } | null;
} {
  let replaced: { productId: string; items: BundleItemInput[] } | null = null;
  const repository: IBundleRepository = {
    listByProduct: async () =>
      options?.describeError
        ? err(new InvariantViolationError("Database error: down"))
        : ok(options?.list ?? []),
    describeComponents: async (variantIds) => {
      if (options?.describeError) {
        return err(new InvariantViolationError("Database error: down"));
      }
      const record: Record<string, ComponentInfo> = {};
      for (const id of variantIds) {
        const found = options?.describe?.[id];
        if (found) {
          record[id] = found;
        }
      }
      return ok(record);
    },
    replaceForProduct: async (productId, items) => {
      if (options?.replaceError) {
        return err(new InvariantViolationError("Database error: down"));
      }
      replaced = { productId, items };
      return ok(undefined);
    },
  };
  return { repository, replaced: () => replaced };
}

describe("computeBundleStockQty", () => {
  it("mengembalikan 0 untuk bundle tanpa komponen", () => {
    expect(computeBundleStockQty([])).toBe(0);
  });

  it("membatasi dengan jumlah bundle yang bisa dirakit", () => {
    expect(
      computeBundleStockQty([{ variantId: "a", qty: 3, stockQty: 10 }])
    ).toBe(3);
  });

  it("mengambil min atas seluruh komponen", () => {
    // komponen A cukup untuk 10 bundle, komponen B hanya untuk 2
    expect(
      computeBundleStockQty([
        { variantId: "a", qty: 1, stockQty: 10 },
        { variantId: "b", qty: 2, stockQty: 5 },
      ])
    ).toBe(2);
  });

  it("menjadi 0 bila ada komponen habis atau stok negatif", () => {
    expect(
      computeBundleStockQty([
        { variantId: "a", qty: 1, stockQty: 4 },
        { variantId: "b", qty: 1, stockQty: 0 },
      ])
    ).toBe(0);
    expect(
      computeBundleStockQty([{ variantId: "a", qty: 1, stockQty: -2 }])
    ).toBe(0);
  });
});

describe("validateBundleItems", () => {
  it("menerima komponen valid dari produk lain", () => {
    const result = validateBundleItems(
      PRODUCT_ID,
      [{ componentVariantId: COMPONENT_ID, qty: 2 }],
      (id) => (id === COMPONENT_ID ? info() : null)
    );
    expect(result).toBeNull();
  });

  it("menolak komponen duplikat", () => {
    const result = validateBundleItems(
      PRODUCT_ID,
      [
        { componentVariantId: COMPONENT_ID, qty: 1 },
        { componentVariantId: COMPONENT_ID, qty: 2 },
      ],
      () => info()
    );
    expect(result).toContain("duplikat");
  });

  it("menolak qty nol atau negatif", () => {
    expect(
      validateBundleItems(
        PRODUCT_ID,
        [{ componentVariantId: COMPONENT_ID, qty: 0 }],
        () => info()
      )
    ).toContain("lebih dari 0");
  });

  it("menolak qty melebihi batas", () => {
    expect(
      validateBundleItems(
        PRODUCT_ID,
        [{ componentVariantId: COMPONENT_ID, qty: BUNDLE_ITEM_MAX_QTY + 1 }],
        () => info()
      )
    ).toContain(String(BUNDLE_ITEM_MAX_QTY));
  });

  it("menolak komponen yang tidak ditemukan", () => {
    const result = validateBundleItems(
      PRODUCT_ID,
      [{ componentVariantId: COMPONENT_ID, qty: 1 }],
      () => null
    );
    expect(result).toContain("tidak ditemukan");
  });

  it("menolak komponen dari produk yang sama", () => {
    const result = validateBundleItems(
      PRODUCT_ID,
      [{ componentVariantId: COMPONENT_ID, qty: 1 }],
      () => info({ productId: PRODUCT_ID })
    );
    expect(result).toContain("produk lain");
  });

  it("menolak komponen berupa bundle (larangan nesting)", () => {
    const result = validateBundleItems(
      PRODUCT_ID,
      [{ componentVariantId: COMPONENT_ID, qty: 1 }],
      () => info({ isBundle: true })
    );
    expect(result).toContain("bundle lain");
  });
});

describe("SaveBundleItemsUseCase", () => {
  it("menyimpan komponen valid ke seluruh varian produk", async () => {
    const { repository, replaced } = bundleRepo({
      describe: { [COMPONENT_ID]: info() },
    });
    const useCase = new SaveBundleItemsUseCase(repository);
    const result = await useCase.execute({
      productId: PRODUCT_ID,
      items: [{ componentVariantId: COMPONENT_ID, qty: 2 }],
    });

    expect(result.success).toBe(true);
    expect(replaced()?.productId).toBe(PRODUCT_ID);
    expect(replaced()?.items).toEqual([
      { componentVariantId: COMPONENT_ID, qty: 2 },
    ]);
  });

  it("menolak productId bukan uuid", async () => {
    const { repository } = bundleRepo();
    const useCase = new SaveBundleItemsUseCase(repository);
    const result = await useCase.execute({
      productId: "bukan-uuid",
      items: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(
        (result.error as ValidationError).validationErrors?.productId
      ).toBeDefined();
    }
  });

  it("menolak qty di bawah 1 lewat skema", async () => {
    const { repository } = bundleRepo({
      describe: { [COMPONENT_ID]: info() },
    });
    const useCase = new SaveBundleItemsUseCase(repository);
    const result = await useCase.execute({
      productId: PRODUCT_ID,
      items: [{ componentVariantId: COMPONENT_ID, qty: 0 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("menolak komponen bundle lain (nesting)", async () => {
    const { repository } = bundleRepo({
      describe: { [COMPONENT_ID]: info({ isBundle: true }) },
    });
    const useCase = new SaveBundleItemsUseCase(repository);
    const result = await useCase.execute({
      productId: PRODUCT_ID,
      items: [{ componentVariantId: COMPONENT_ID, qty: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toContain("bundle lain");
    }
  });

  it("menolak komponen dari produk yang sama", async () => {
    const { repository } = bundleRepo({
      describe: { [COMPONENT_ID]: info({ productId: PRODUCT_ID }) },
    });
    const useCase = new SaveBundleItemsUseCase(repository);
    const result = await useCase.execute({
      productId: PRODUCT_ID,
      items: [{ componentVariantId: COMPONENT_ID, qty: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("produk lain");
    }
  });

  it("meneruskan error repository saat describe", async () => {
    const { repository } = bundleRepo({ describeError: true });
    const useCase = new SaveBundleItemsUseCase(repository);
    const result = await useCase.execute({
      productId: PRODUCT_ID,
      items: [{ componentVariantId: COMPONENT_ID, qty: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvariantViolationError);
    }
  });

  it("meneruskan error repository saat menyimpan", async () => {
    const { repository } = bundleRepo({
      describe: { [COMPONENT_ID]: info() },
      replaceError: true,
    });
    const useCase = new SaveBundleItemsUseCase(repository);
    const result = await useCase.execute({
      productId: PRODUCT_ID,
      items: [{ componentVariantId: COMPONENT_ID, qty: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvariantViolationError);
    }
  });
});

describe("GetBundleItemsUseCase", () => {
  const component: BundleComponent = {
    variantId: COMPONENT_ID,
    productId: OTHER_PRODUCT_ID,
    productName: "Beras",
    variantName: "",
    sku: "BRS-5KG",
    qty: 1,
    stockQty: 7,
  };

  it("mengembalikan daftar komponen", async () => {
    const { repository } = bundleRepo({ list: [component] });
    const useCase = new GetBundleItemsUseCase(repository);
    const result = await useCase.execute(PRODUCT_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.sku).toBe("BRS-5KG");
    }
  });

  it("menolak productId tidak valid", async () => {
    const { repository } = bundleRepo();
    const useCase = new GetBundleItemsUseCase(repository);
    const result = await useCase.execute("bukan-uuid");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it("meneruskan error repository", async () => {
    const { repository } = bundleRepo({ describeError: true });
    const useCase = new GetBundleItemsUseCase(repository);
    const result = await useCase.execute(PRODUCT_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvariantViolationError);
    }
  });
});

import { z } from "zod";
import type {
  BundleComponent,
  BundleItemInput,
  IBundleRepository,
} from "@/modules/catalog/domain/repositories/bundle.repository";
import { validateBundleItems } from "@/modules/catalog/domain/services/bundle-policy";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export const BundleItemsSchema = z.object({
  productId: z.uuid({ error: "ID produk tidak valid" }),
  items: z
    .array(
      z.object({
        componentVariantId: z.uuid({ error: "ID komponen tidak valid" }),
        qty: z
          .number({ error: "Qty komponen harus angka" })
          .min(1, { error: "Qty komponen minimal 1" }),
      })
    )
    .max(50, { error: "Maksimal 50 komponen per bundle" }),
});

export type SaveBundleItemsInput = z.input<typeof BundleItemsSchema>;

/** Daftar komponen bundle untuk ditampilkan di form produk. */
export class GetBundleItemsUseCase {
  constructor(private readonly bundles: IBundleRepository) {}

  public async execute(
    productId: string
  ): Promise<Result<BundleComponent[], DomainError>> {
    if (!z.uuid().safeParse(productId).success) {
      return err(new NotFoundError("Produk", productId));
    }
    return this.bundles.listByProduct(productId);
  }
}

/**
 * Simpan komponen bundle untuk seluruh varian produk (replace-all).
 * Validasi: komponen ada, bukan bundle (no nesting), tanpa duplikat/ diri sendiri.
 */
export class SaveBundleItemsUseCase {
  constructor(private readonly bundles: IBundleRepository) {}

  public async execute(
    rawInput: SaveBundleItemsInput
  ): Promise<Result<BundleItemInput[], DomainError>> {
    const parsed = BundleItemsSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return err(
        new ValidationError("Komponen bundle tidak valid", fieldErrors)
      );
    }

    const { productId, items } = parsed.data;
    const described = await this.bundles.describeComponents(
      items.map((i) => i.componentVariantId)
    );
    if (isErr(described)) {
      return err(described.error);
    }

    const componentIds = new Set(items.map((i) => i.componentVariantId));
    const invalid = validateBundleItems(productId, items, (variantId) =>
      componentIds.has(variantId) ? described.data[variantId] : null
    );
    if (invalid !== null) {
      return err(new ValidationError(invalid));
    }

    const saved = await this.bundles.replaceForProduct(productId, items);
    if (isErr(saved)) {
      return err(saved.error);
    }
    return ok(items);
  }
}

// Sub-PRD 4.1 (PRD-05): kebijakan bundle — stok efektif & validasi komponen.

export interface BundleComponentStock {
  /** Varian komponen. */
  variantId: string;
  /** Qty komponen per satu bundle. */
  qty: number;
  /** Stok komponen saat ini. */
  stockQty: number;
}

/**
 * Stok efektif bundle = jumlah bundle yang bisa dirakit,
 * yaitu min atas floor(stok komponen / qty per bundle).
 * Bundle tanpa komponen dianggap stok 0.
 */
export function computeBundleStockQty(
  components: BundleComponentStock[]
): number {
  if (components.length === 0) {
    return 0;
  }
  return Math.min(
    ...components.map((c) =>
      Math.floor(Math.max(c.stockQty, 0) / Math.max(c.qty, 1))
    )
  );
}

export interface BundleItemInput {
  componentVariantId: string;
  qty: number;
}

export const BUNDLE_ITEM_MAX_QTY = 9999;

/**
 * Validasi data komponen bundle sebelum disimpan (info varian sudah diambil
 * dari database): tanpa duplikat, bukan produk yang sama, komponen bukan
 * bundle lain (nesting dilarang — checkout hanya melebar satu tingkat).
 */
export function validateBundleItems(
  bundleProductId: string,
  items: BundleItemInput[],
  describe: (
    variantId: string
  ) => { productId: string; isBundle: boolean } | null | undefined
): string | null {
  if (items.length > 50) {
    return "Maksimal 50 komponen per bundle";
  }
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.componentVariantId)) {
      return "Ada komponen duplikat — gabungkan dalam satu baris";
    }
    seen.add(item.componentVariantId);

    if (!Number.isFinite(item.qty) || item.qty <= 0) {
      return "Qty komponen harus lebih dari 0";
    }
    if (item.qty > BUNDLE_ITEM_MAX_QTY) {
      return `Qty komponen maksimal ${BUNDLE_ITEM_MAX_QTY}`;
    }

    const info = describe(item.componentVariantId);
    if (!info) {
      return "Komponen bundle tidak ditemukan";
    }
    if (info.productId === bundleProductId) {
      return "Komponen harus berasal dari produk lain";
    }
    if (info.isBundle) {
      return "Komponen bundle tidak boleh berupa bundle lain";
    }
  }
  return null;
}

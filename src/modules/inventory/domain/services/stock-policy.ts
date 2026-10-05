export type StockStatus = "normal" | "menipis" | "habis";

export interface StockOverview {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  minStock: number;
  trackStock: boolean;
  qty: number;
  status: StockStatus;
}

export function computeStockStatus(qty: number, minStock: number): StockStatus {
  if (qty <= 0) {
    return "habis";
  }
  if (qty <= minStock) {
    return "menipis";
  }
  return "normal";
}

/**
 * Kebijakan pengurangan stok (PRD INV-01/INV-02).
 * Stok tidak boleh negatif kecuali pengaturan "izinkan stok minus" aktif.
 */
export class StockPolicy {
  public static canDeduct(
    currentQty: number,
    deductQty: number,
    allowNegative: boolean
  ): boolean {
    if (deductQty <= 0) {
      return false;
    }
    if (allowNegative) {
      return true;
    }
    return currentQty - deductQty >= 0;
  }

  public static statusOf(
    qty: number,
    minStock: number,
    trackStock: boolean
  ): StockStatus | "tidak dilacak" {
    if (!trackStock) {
      return "tidak dilacak";
    }
    return computeStockStatus(qty, minStock);
  }
}

import {
  Stock,
  StockMovement,
  isStockMovementType,
  type StockMovementType,
} from "@/modules/inventory/domain/entities/stock";
import type {
  StockOverview,
  StockStatus,
} from "@/modules/inventory/domain/services/stock-policy";

export interface StockOverviewRow {
  variant_id: string | null;
  product_id: string | null;
  product_name: string | null;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  category_name: string | null;
  min_stock: number | string | null;
  track_stock: boolean | null;
  qty: number | string | null;
  status: string | null;
}

const VALID_STATUSES: StockStatus[] = ["normal", "menipis", "habis"];

export function mapStockOverviewRow(
  row: StockOverviewRow
): StockOverview | null {
  if (!row.variant_id || !row.product_id || !row.sku) {
    return null;
  }
  const status: StockStatus = VALID_STATUSES.includes(row.status as StockStatus)
    ? (row.status as StockStatus)
    : "normal";
  return {
    variantId: row.variant_id,
    productId: row.product_id,
    productName: row.product_name ?? "-",
    variantName: row.variant_name ?? "",
    sku: row.sku,
    barcode: row.barcode,
    categoryId: row.category_id,
    categoryName: row.category_name,
    minStock: Number(row.min_stock ?? 0),
    trackStock: row.track_stock ?? true,
    qty: Number(row.qty ?? 0),
    status,
  };
}

export interface StockMovementRow {
  id: string;
  variant_id: string;
  type: string;
  qty_change: number | string;
  balance_after: number | string;
  ref_type: string | null;
  ref_id: string | null;
  note: string;
  created_by: string | null;
  created_at: string;
  batch_id?: string | null;
  stock_batches?: { batch_no: string; expiry_date: string | null } | null;
}

export function mapStockMovementRow(
  row: StockMovementRow
): StockMovement | null {
  if (!isStockMovementType(row.type)) {
    return null;
  }
  const type: StockMovementType = row.type;
  return StockMovement.create(
    {
      variantId: row.variant_id,
      type,
      qtyChange: Number(row.qty_change),
      balanceAfter: Number(row.balance_after),
      refType: row.ref_type,
      refId: row.ref_id,
      note: row.note,
      createdBy: row.created_by,
      batchId: row.batch_id ?? null,
      batchNo: row.stock_batches?.batch_no ?? null,
      batchExpiryDate: row.stock_batches?.expiry_date ?? null,
    },
    row.id,
    new Date(row.created_at)
  );
}

export function mapStockRow(row: {
  variant_id: string;
  qty: number | string;
}): Stock {
  return Stock.create({ variantId: row.variant_id, qty: Number(row.qty) });
}

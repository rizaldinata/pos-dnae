export interface TopProduct {
  productId: string;
  productName: string;
  qtySold: number;
  revenue: number;
}

export interface ProductSalesRow {
  productId: string | null;
  productName: string;
  variantId: string | null;
  variantName: string;
  sku: string;
  qtySold: number;
  revenue: number;
  avgPrice: number;
}

export interface CategorySalesRow {
  categoryId: string | null;
  categoryName: string;
  qtySold: number;
  revenue: number;
  sharePercent: number;
}

export interface CashierSalesRow {
  userId: string;
  cashierName: string;
  transactions: number;
  revenue: number;
  avgPerTransaction: number;
}

export interface PaymentMethodSalesRow {
  methodName: string;
  methodType: string;
  transactions: number;
  total: number;
  sharePercent: number;
}

export interface StockValuationRow {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  qty: number;
  costPrice: number;
  stockValue: number;
}

export function withShare<T extends { revenue: number }>(
  rows: T[]
): (T & { sharePercent: number })[] {
  const total = rows.reduce((sum, r) => sum + r.revenue, 0);
  return rows.map((r) => ({
    ...r,
    sharePercent: total > 0 ? Math.round((r.revenue / total) * 1000) / 10 : 0,
  }));
}

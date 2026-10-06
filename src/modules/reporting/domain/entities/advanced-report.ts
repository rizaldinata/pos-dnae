export type ProfitSortKey = "profit" | "margin" | "qty" | "revenue" | "name";
export type ProfitGranularity = "day" | "week" | "month";

/** Baris laba per produk (RPT-05). */
export interface ProductProfitRow {
  productId: string;
  productName: string;
  qtySold: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPercent: number;
}

/** Baris laba per periode hari/minggu/bulan (RPT-05). */
export interface PeriodProfitRow {
  /** Awal periode bucket, YYYY-MM-DD (Senin untuk granularity "week"). */
  periodStart: string;
  netSales: number;
  cogs: number;
  expenseTotal: number;
  netProfit: number;
}

export interface PeriodTotals {
  netSales: number;
  cogs: number;
  expenseTotal: number;
  netProfit: number;
}

export function sumPeriodRows(rows: PeriodProfitRow[]): PeriodTotals {
  return rows.reduce<PeriodTotals>(
    (acc, row) => ({
      netSales: acc.netSales + Math.round(row.netSales),
      cogs: acc.cogs + Math.round(row.cogs),
      expenseTotal: acc.expenseTotal + Math.round(row.expenseTotal),
      netProfit: acc.netProfit + Math.round(row.netProfit),
    }),
    { netSales: 0, cogs: 0, expenseTotal: 0, netProfit: 0 }
  );
}

/**
 * Perubahan dalam persen dari periode sebelumnya.
 * Mengembalikan `null` bila periode pembanding nol (tidak bisa dibagi).
 */
export function deltaPercent(current: number, previous: number): number | null {
  if (Math.round(previous) === 0) {
    return null;
  }
  const change = Math.round(current) - Math.round(previous);
  return Math.round((change / Math.abs(Math.round(previous))) * 1000) / 10;
}

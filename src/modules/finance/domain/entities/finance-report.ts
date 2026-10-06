/** Rincian pengeluaran operasional per kategori (untuk laba rugi). */
export interface ExpenseSummaryRow {
  categoryId: string;
  categoryName: string;
  entries: number;
  /** Rupiah bulat. */
  total: number;
}

/** Rekap laba per bulan untuk grafik tren (1 baris per bulan). */
export interface MonthlyProfitRow {
  /** YYYY-MM-01 */
  monthStart: string;
  netSales: number;
  cogs: number;
  expenseTotal: number;
  netProfit: number;
}

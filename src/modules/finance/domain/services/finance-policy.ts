/** Arah arus kas: masuk ("in") atau keluar ("out"). */
export type CashFlowDirection = "in" | "out";

export interface CashFlowRow {
  direction: CashFlowDirection;
  source: string;
  label: string;
  entries: number;
  /** Rupiah bulat. */
  amount: number;
}

export interface CashFlowSummary {
  inflow: number;
  outflow: number;
  /** Kas masuk - kas keluar dalam periode. */
  balance: number;
  inflows: CashFlowRow[];
  outflows: CashFlowRow[];
}

export interface ProfitLossSummary {
  grossSales: number;
  discountTotal: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  expenseTotal: number;
  netProfit: number;
}

/**
 * Aturan perhitungan laporan keuangan (FIN-02/03).
 * Semua nilai dalam rupiah bulat; komputasi berat dilakukan di database
 * (SQL function) — policy ini menghitung turunan yang ringan.
 */
export class FinancePolicy {
  /** Validasi urutan periode laporan: dari <= sampai. */
  public static isChronological(from: string, to: string): boolean {
    return from <= to;
  }

  /** Margin laba bersih dalam persen (0 bila penjualan neto nol). */
  public static marginPercent(netProfit: number, netSales: number): number {
    const sales = Math.round(netSales);
    if (sales <= 0) {
      return 0;
    }
    return Math.round((Math.round(netProfit) / sales) * 1000) / 10;
  }

  /** Kelompokkan baris arus kas per arah dan hitung saldo periode. */
  public static summarizeCashFlow(rows: CashFlowRow[]): CashFlowSummary {
    const inflows: CashFlowRow[] = [];
    const outflows: CashFlowRow[] = [];
    let inflow = 0;
    let outflow = 0;
    for (const row of rows) {
      const amount = Math.round(row.amount);
      if (row.direction === "in") {
        inflows.push({ ...row, amount });
        inflow += amount;
      } else {
        outflows.push({ ...row, amount });
        outflow += amount;
      }
    }
    inflows.sort((a, b) => b.amount - a.amount);
    outflows.sort((a, b) => b.amount - a.amount);
    return {
      inflow,
      outflow,
      balance: inflow - outflow,
      inflows,
      outflows,
    };
  }

  /**
   * Jendela `months` bulan (termasuk bulan `dateTo`) untuk grafik tren.
   * Mengembalikan batas periode YYYY-MM-DD.
   */
  public static monthWindow(
    dateTo: string,
    months: number
  ): { from: string; to: string } {
    const [y, m, d] = dateTo.split("-").map(Number);
    const year = y ?? 0;
    const month = m ?? 1;
    const day = d ?? 1;
    if (year < 1970 || month < 1 || month > 12 || day < 1) {
      return { from: dateTo, to: dateTo };
    }
    const start = new Date(Date.UTC(year, month - 1 - (months - 1), 1));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const safeDay = Math.min(day, lastDay);
    return {
      from: start.toISOString().slice(0, 10),
      to: `${dateTo.slice(0, 8)}${String(safeDay).padStart(2, "0")}`,
    };
  }
}

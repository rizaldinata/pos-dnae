export interface SalesDaySummary {
  day: string;
  transactions: number;
  grossSales: number;
  discountTotal: number;
  netSales: number;
  itemsSold: number;
}

export interface SalesSummaryTotals {
  transactions: number;
  grossSales: number;
  discountTotal: number;
  netSales: number;
  itemsSold: number;
  averagePerTransaction: number;
}

export function sumDaySummaries(days: SalesDaySummary[]): SalesSummaryTotals {
  const totals = days.reduce<SalesSummaryTotals>(
    (acc, d) => ({
      transactions: acc.transactions + d.transactions,
      grossSales: acc.grossSales + d.grossSales,
      discountTotal: acc.discountTotal + d.discountTotal,
      netSales: acc.netSales + d.netSales,
      itemsSold: acc.itemsSold + d.itemsSold,
      averagePerTransaction: 0,
    }),
    {
      transactions: 0,
      grossSales: 0,
      discountTotal: 0,
      netSales: 0,
      itemsSold: 0,
      averagePerTransaction: 0,
    }
  );
  return {
    ...totals,
    averagePerTransaction:
      totals.transactions > 0
        ? Math.round(totals.netSales / totals.transactions)
        : 0,
  };
}

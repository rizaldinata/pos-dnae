"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { chartTooltipStyle } from "@/shared/ui/chart-theme";
import { formatDateJakarta } from "@/shared/lib/date";
import type {
  PeriodProfitRow,
  ProfitGranularity,
} from "@/modules/reporting/domain/entities/advanced-report";

function periodLabel(periodStart: string, grain: ProfitGranularity): string {
  if (grain === "month") {
    return formatDateJakarta(`${periodStart.slice(0, 7)}-01`, {
      month: "short",
      year: "2-digit",
    });
  }
  return formatDateJakarta(periodStart, { day: "2-digit", month: "short" });
}

export function PeriodProfitChart({
  rows,
  granularity,
}: {
  rows: PeriodProfitRow[];
  granularity: ProfitGranularity;
}) {
  if (rows.length === 0) {
    return null;
  }
  const data = rows.map((row) => ({
    label: periodLabel(row.periodStart, granularity),
    netProfit: row.netProfit,
    netSales: row.netSales,
    expenseTotal: row.expenseTotal,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tren laba bersih</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(value: number) =>
                  value >= 1000000
                    ? `${Math.round(value / 1000000)}jt`
                    : `${Math.round(value / 1000)}rb`
                }
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value, name) => [
                  formatRupiah(Number(value ?? 0)),
                  name === "netSales"
                    ? "Penjualan neto"
                    : name === "expenseTotal"
                      ? "Pengeluaran"
                      : "Laba bersih",
                ]}
              />
              <Bar dataKey="netProfit" radius={[4, 4, 0, 0]}>
                {data.map((point, index) => (
                  <Cell
                    key={index}
                    fill={
                      point.netProfit < 0
                        ? "var(--destructive)"
                        : "var(--primary)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

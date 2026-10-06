"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyProfitRow } from "@/modules/finance/domain/entities/finance-report";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { chartTooltipStyle } from "@/shared/ui/chart-theme";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function monthLabel(monthStart: string): string {
  const month = Number(monthStart.slice(5, 7));
  return MONTH_LABELS[month - 1] ?? monthStart;
}

/** Grafik tren laba bersih 12 bulan terakhir (FIN-03). */
export function ProfitLossChart({ data }: { data: MonthlyProfitRow[] }) {
  if (data.length === 0) {
    return null;
  }
  const points = data.map((row) => ({
    label: monthLabel(row.monthStart),
    netProfit: row.netProfit,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tren laba per bulan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
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
                formatter={(value) => [
                  formatRupiah(Number(value ?? 0)),
                  "Laba bersih",
                ]}
                labelFormatter={(label) => `Bulan ${label}`}
              />
              <Bar
                dataKey="netProfit"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

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
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { chartTooltipStyle } from "@/shared/ui/chart-theme";

export interface SalesChartPoint {
  day: string;
  label: string;
  netSales: number;
  transactions: number;
}

export function SalesChart({ data }: { data: SalesChartPoint[] }) {
  if (data.length === 0) {
    return null;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Penjualan per hari</CardTitle>
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
                  name === "netSales"
                    ? formatRupiah(Number(value ?? 0))
                    : value,
                  name === "netSales" ? "Penjualan" : "Transaksi",
                ]}
                labelFormatter={(label) => `Tanggal ${label}`}
              />
              <Bar
                dataKey="netSales"
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

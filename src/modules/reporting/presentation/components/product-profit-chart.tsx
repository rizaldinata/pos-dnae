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
import type { ProductProfitRow } from "@/modules/reporting/domain/entities/advanced-report";

/** Top 10 produk paling menguntungkan (RPT-05), batang horizontal. */
export function ProductProfitChart({ rows }: { rows: ProductProfitRow[] }) {
  const top = [...rows]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 10)
    .map((row) => ({ label: row.productName, profit: row.profit }));
  if (top.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 produk paling menguntungkan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={top}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(value: number) =>
                  value >= 1000000
                    ? `${Math.round(value / 1000000)}jt`
                    : `${Math.round(value / 1000)}rb`
                }
              />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value) => [
                  formatRupiah(Number(value ?? 0)),
                  "Laba",
                ]}
              />
              <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                {top.map((point, index) => (
                  <Cell
                    key={index}
                    fill={
                      point.profit < 0 ? "var(--destructive)" : "var(--primary)"
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

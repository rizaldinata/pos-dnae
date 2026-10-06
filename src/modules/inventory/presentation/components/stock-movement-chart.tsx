"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { chartTooltipStyle } from "@/shared/ui/chart-theme";

export interface MovementPoint {
  id: string;
  createdAt: string;
  label: string;
  balanceAfter: number;
  qtyChange: number;
}

export function StockMovementChart({ points }: { points: MovementPoint[] }) {
  if (points.length < 2) {
    return null;
  }
  const ascending = [...points].reverse();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Tren saldo stok
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={ascending}
              margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(value) => [value, "Saldo"]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload
                    ? `${(payload[0].payload as MovementPoint).createdAt}`
                    : ""
                }
              />
              <Line
                type="monotone"
                dataKey="balanceAfter"
                stroke="var(--primary)"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

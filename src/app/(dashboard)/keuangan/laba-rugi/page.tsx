import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { FinanceNav } from "@/modules/finance/presentation/components/finance-nav";
import { ProfitLossChart } from "@/modules/finance/presentation/components/profit-loss-chart";
import { FinancePolicy } from "@/modules/finance/domain/services/finance-policy";
import { OperationalFilters } from "@/modules/reporting/presentation/components/operational-filters";
import { ExportButtons } from "@/modules/reporting/presentation/components/export-buttons";
import { toISODateJakarta } from "@/shared/lib/date";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { isErr } from "@/shared/kernel/result";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Laba Rugi — POS DNAE",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function SummaryItem({
  label,
  value,
  emphasis,
  hint,
}: {
  label: string;
  value: number;
  emphasis?: "profit" | "loss";
  hint?: string;
}) {
  const valueClass =
    emphasis === "profit"
      ? "text-green-600"
      : emphasis === "loss"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-xl font-semibold ${valueClass}`}>
        {formatRupiah(value)}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const guard = await requirePermission("report.profit.view");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const today = toISODateJakarta(new Date());
  const dateFrom =
    params.from && DATE_RE.test(params.from)
      ? params.from
      : `${today.slice(0, 7)}-01`;
  const dateTo = params.to && DATE_RE.test(params.to) ? params.to : today;

  const container = await getAppContainer();
  const [reportResult, trendResult] = await Promise.all([
    container.finance.getProfitLoss.execute({ dateFrom, dateTo }),
    container.finance.getProfitTrend.execute(dateTo),
  ]);
  if (isErr(reportResult)) {
    throw new Error(reportResult.error.message);
  }
  if (isErr(trendResult)) {
    throw new Error(trendResult.error.message);
  }
  const report = reportResult.data;
  const { summary, expensesByCategory } = report;
  const grossMargin = FinancePolicy.marginPercent(
    summary.grossProfit,
    summary.netSales
  );
  const netMargin = FinancePolicy.marginPercent(
    summary.netProfit,
    summary.netSales
  );

  return (
    <div className="flex flex-col gap-4">
      <FinanceNav permissions={guard.user.permissions} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Laporan laba rugi</h1>
          <p className="text-sm text-muted-foreground">
            Penjualan - HPP - pengeluaran ({report.from} s/d {report.to})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OperationalFilters
            dateFrom={report.from}
            dateTo={report.to}
            categories={[]}
            currentCategoryId=""
          />
          <ExportButtons
            type="laba-rugi"
            pdf
            query={{ from: report.from, to: report.to }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan periode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryItem label="Penjualan bruto" value={summary.grossSales} />
            <SummaryItem label="Diskon" value={-summary.discountTotal} />
            <SummaryItem label="Penjualan neto" value={summary.netSales} />
            <SummaryItem
              label="HPP"
              value={-summary.cogs}
              hint="Snapshot cost_price × qty"
            />
            <SummaryItem
              label="Laba kotor"
              value={summary.grossProfit}
              emphasis={summary.grossProfit < 0 ? "loss" : "profit"}
              hint={`Margin ${grossMargin}%`}
            />
            <SummaryItem
              label="Pengeluaran operasional"
              value={-summary.expenseTotal}
            />
            <SummaryItem
              label="Laba bersih"
              value={summary.netProfit}
              emphasis={summary.netProfit < 0 ? "loss" : "profit"}
              hint={`Margin ${netMargin}%`}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pengeluaran per kategori</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesByCategory.map((row) => (
                    <TableRow key={row.categoryId}>
                      <TableCell>{row.categoryName}</TableCell>
                      <TableCell className="text-right">
                        {row.entries}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatRupiah(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {expensesByCategory.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground"
                      >
                        Tidak ada pengeluaran pada periode ini
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <ProfitLossChart data={trendResult.data.months} />
      </div>
    </div>
  );
}

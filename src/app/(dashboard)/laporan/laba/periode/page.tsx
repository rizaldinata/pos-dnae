import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { OperationalFilters } from "@/modules/reporting/presentation/components/operational-filters";
import { GranularityFilter } from "@/modules/reporting/presentation/components/granularity-filter";
import { PeriodProfitChart } from "@/modules/reporting/presentation/components/period-profit-chart";
import { ExportButtons } from "@/modules/reporting/presentation/components/export-buttons";
import type { ProfitGranularity } from "@/modules/reporting/domain/entities/advanced-report";
import { toISODateJakarta, formatDateJakarta } from "@/shared/lib/date";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Laba Per Periode — POS DNAE",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00+07:00`);
  d.setDate(d.getDate() + days);
  return toISODateJakarta(d);
}

function periodLabel(periodStart: string, grain: ProfitGranularity): string {
  if (grain === "month") {
    return formatDateJakarta(`${periodStart.slice(0, 7)}-01`, {
      month: "long",
      year: "numeric",
    });
  }
  if (grain === "week") {
    return `Mgg ${formatDateJakarta(periodStart, { day: "2-digit", month: "short" })}`;
  }
  return formatDateJakarta(periodStart, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DeltaHint({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="text-xs text-muted-foreground">
        Tidak ada pembanding
      </span>
    );
  }
  const sign = delta > 0 ? "+" : "";
  const color =
    delta > 0
      ? "text-green-600"
      : delta < 0
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <span className={`text-xs ${color}`}>
      {sign}
      {delta}% vs periode sebelumnya
    </span>
  );
}

export default async function PeriodProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; grain?: string }>;
}) {
  const guard = await requirePermission("report.profit.view");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const granularity: ProfitGranularity =
    params.grain === "week" || params.grain === "month" ? params.grain : "day";
  const today = toISODateJakarta(new Date());
  const defaultSpan =
    granularity === "day" ? 29 : granularity === "week" ? 83 : 364;
  const dateFrom =
    params.from && DATE_RE.test(params.from)
      ? params.from
      : addDays(today, -defaultSpan);
  const dateTo = params.to && DATE_RE.test(params.to) ? params.to : today;

  const container = await getAppContainer();
  const result = await container.reporting.getPeriodProfit.execute({
    dateFrom,
    dateTo,
    granularity,
  });
  if (isErr(result)) {
    throw new Error(result.error.message);
  }
  const report = result.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Laba per periode</h1>
          <p className="text-sm text-muted-foreground">
            Penjualan neto - HPP - pengeluaran per{" "}
            {granularity === "day"
              ? "hari"
              : granularity === "week"
                ? "minggu"
                : "bulan"}{" "}
            ({report.from} s/d {report.to})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/laporan/laba/produk">
            <Button variant="outline" size="sm">
              Laba Produk
            </Button>
          </Link>
          <ExportButtons
            type="laba-periode"
            query={{
              from: report.from,
              to: report.to,
              grain: report.granularity,
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <OperationalFilters
          dateFrom={report.from}
          dateTo={report.to}
          categories={[]}
          currentCategoryId=""
        />
        <GranularityFilter value={report.granularity} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ringkasan vs periode sebelumnya</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">
                Penjualan neto
              </span>
              <span className="text-xl font-semibold">
                {formatRupiah(report.totals.netSales)}
              </span>
              <DeltaHint delta={report.deltas.netSales} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Laba bersih</span>
              <span
                className={`text-xl font-semibold ${report.totals.netProfit < 0 ? "text-destructive" : "text-green-600"}`}
              >
                {formatRupiah(report.totals.netProfit)}
              </span>
              <DeltaHint delta={report.deltas.netProfit} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">HPP</span>
              <span className="text-xl font-semibold">
                {formatRupiah(-report.totals.cogs)}
              </span>
              <span className="text-xs text-muted-foreground">
                Snapshot cost_price × qty
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Pengeluaran</span>
              <span className="text-xl font-semibold">
                {formatRupiah(-report.totals.expenseTotal)}
              </span>
              <span className="text-xs text-muted-foreground">
                Pembanding: {report.previous.from} s/d {report.previous.to}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <PeriodProfitChart rows={report.rows} granularity={report.granularity} />

      <Card>
        <CardHeader>
          <CardTitle>Rincian per periode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Penjualan neto</TableHead>
                  <TableHead className="text-right">HPP</TableHead>
                  <TableHead className="text-right">Pengeluaran</TableHead>
                  <TableHead className="text-right">Laba bersih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.periodStart}>
                    <TableCell>
                      {periodLabel(row.periodStart, report.granularity)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(row.netSales)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(row.cogs)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(row.expenseTotal)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${row.netProfit < 0 ? "text-destructive" : ""}`}
                    >
                      {formatRupiah(row.netProfit)}
                    </TableCell>
                  </TableRow>
                ))}
                {report.rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      Tidak ada data pada periode ini
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

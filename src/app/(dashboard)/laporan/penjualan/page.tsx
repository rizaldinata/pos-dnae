import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { SalesChart } from "@/modules/reporting/presentation/components/sales-chart";
import { ReportFilters } from "@/modules/reporting/presentation/components/report-filters";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { formatDateTimeJakarta, toISODateJakarta } from "@/shared/lib/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Laporan Penjualan — POS DNAE",
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00+07:00`);
  d.setDate(d.getDate() + days);
  return toISODateJakarta(d);
}

function lastDayOfMonth(year: number, month: number): string {
  return toISODateJakarta(new Date(year, month, 0, 12, 0, 0));
}

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    date?: string;
    from?: string;
    to?: string;
    year?: string;
    month?: string;
  }>;
}) {
  const guard = await requirePermission("report.view");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const today = toISODateJakarta(new Date());
  const mode =
    params.mode === "rentang" || params.mode === "bulanan"
      ? params.mode
      : "harian";

  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : today;
  const dateFrom =
    params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)
      ? params.from
      : addDays(today, -6);
  const dateTo =
    params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : today;
  const year = Number(params.year) || Number(today.slice(0, 4));
  const month = Math.min(
    Math.max(Number(params.month) || Number(today.slice(5, 7)), 1),
    12
  );

  const container = await getAppContainer();
  const reportResult = await container.reporting.getSalesReport.execute(
    mode === "harian"
      ? { mode: "daily", date }
      : mode === "rentang"
        ? { mode: "range", dateFrom, dateTo }
        : { mode: "monthly", year, month }
  );
  if (isErr(reportResult)) {
    throw new Error(reportResult.error.message);
  }
  const report = reportResult.data;

  const rangeFrom =
    mode === "harian"
      ? date
      : mode === "rentang"
        ? dateFrom
        : `${report.label}-01`;
  const rangeTo =
    mode === "harian"
      ? date
      : mode === "rentang"
        ? dateTo
        : lastDayOfMonth(year, month);

  const transactionsResult =
    await container.reporting.getRecentTransactions.execute(
      rangeFrom,
      rangeTo,
      20
    );
  if (isErr(transactionsResult)) {
    throw new Error(transactionsResult.error.message);
  }
  const transactions = transactionsResult.data;

  const chartData = report.days.map((d) => ({
    day: d.day,
    label: d.day.slice(8, 10),
    netSales: d.netSales,
    transactions: d.transactions,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Laporan Penjualan</h1>
        <p className="text-sm text-muted-foreground">Periode: {report.label}</p>
      </div>

      <ReportFilters
        mode={mode}
        date={date}
        dateFrom={dateFrom}
        dateTo={dateTo}
        year={year}
        month={month}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Penjualan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatRupiah(report.totals.netSales)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Jumlah Transaksi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.totals.transactions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rata-rata per Transaksi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatRupiah(report.totals.averagePerTransaction)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Item Terjual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.totals.itemsSold}</p>
          </CardContent>
        </Card>
      </div>

      {mode !== "harian" && <SalesChart data={chartData} />}

      <Card>
        <CardHeader>
          <CardTitle>Rincian per hari</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Transaksi</TableHead>
                  <TableHead className="text-right">Kotor</TableHead>
                  <TableHead className="text-right">Diskon</TableHead>
                  <TableHead className="text-right">Bersih</TableHead>
                  <TableHead className="text-right">Item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.days.map((d) => (
                  <TableRow key={d.day}>
                    <TableCell className="font-medium">{d.day}</TableCell>
                    <TableCell className="text-right">
                      {d.transactions}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(d.grossSales)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(d.discountTotal)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatRupiah(d.netSales)}
                    </TableCell>
                    <TableCell className="text-right">{d.itemsSold}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaksi terkini</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/laporan/transaksi/${t.id}`}
                        className="hover:underline"
                      >
                        {t.invoiceNo}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTimeJakarta(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(t.grandTotal)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === "completed" ? "default" : "secondary"
                        }
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      Belum ada transaksi pada periode ini
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

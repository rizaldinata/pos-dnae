import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
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
import { OperationalFilters } from "@/modules/reporting/presentation/components/operational-filters";
import { ExportButtons } from "@/modules/reporting/presentation/components/export-buttons";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { toISODateJakarta } from "@/shared/lib/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Laporan Kasir — POS DNAE",
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00+07:00`);
  d.setDate(d.getDate() + days);
  return toISODateJakarta(d);
}

export default async function CashierReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const guard = await requirePermission("report.view");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const today = toISODateJakarta(new Date());
  const dateFrom =
    params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)
      ? params.from
      : addDays(today, -6);
  const dateTo =
    params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : today;

  const container = await getAppContainer();
  const result = await container.reporting.getOperationalReport.execute({
    dateFrom,
    dateTo,
  });
  if (isErr(result)) {
    throw new Error(result.error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Laporan per Kasir</h1>
          <p className="text-sm text-muted-foreground">
            {result.data.from} s/d {result.data.to} • peringkat pendapatan
          </p>
        </div>
        <ExportButtons type="kasir" query={{ from: dateFrom, to: dateTo }} />
      </div>

      <OperationalFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        categories={[]}
        currentCategoryId=""
      />

      <Card>
        <CardHeader>
          <CardTitle>Peringkat kasir</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Kasir</TableHead>
                  <TableHead className="text-right">Transaksi</TableHead>
                  <TableHead className="text-right">Penjualan</TableHead>
                  <TableHead className="text-right">Rata-rata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.cashierSales.map((c, index) => (
                  <TableRow key={c.userId}>
                    <TableCell className="font-semibold text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.cashierName}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.transactions}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(c.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(c.avgPerTransaction)}
                    </TableCell>
                  </TableRow>
                ))}
                {result.data.cashierSales.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      Belum ada penjualan
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

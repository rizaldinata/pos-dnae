import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { FinanceNav } from "@/modules/finance/presentation/components/finance-nav";
import { OperationalFilters } from "@/modules/reporting/presentation/components/operational-filters";
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
  title: "Arus Kas — POS DNAE",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function FlowTable({
  title,
  rows,
  emptyText,
  total,
}: {
  title: string;
  rows: { label: string; entries: number; amount: number }[];
  emptyText: string;
  total: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sumber</TableHead>
                <TableHead className="text-right">Transaksi</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right">{row.entries}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatRupiah(row.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    {emptyText}
                  </TableCell>
                </TableRow>
              )}
              {rows.length > 0 && (
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right" />
                  <TableCell className="text-right font-semibold">
                    {formatRupiah(total)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function CashFlowPage({
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
    params.from && DATE_RE.test(params.from)
      ? params.from
      : `${today.slice(0, 7)}-01`;
  const dateTo = params.to && DATE_RE.test(params.to) ? params.to : today;

  const container = await getAppContainer();
  const result = await container.finance.getCashFlow.execute({
    dateFrom,
    dateTo,
  });
  if (isErr(result)) {
    throw new Error(result.error.message);
  }
  const { summary } = result.data;

  return (
    <div className="flex flex-col gap-4">
      <FinanceNav permissions={guard.user.permissions} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Laporan kas masuk/keluar</h1>
          <p className="text-sm text-muted-foreground">
            {dateFrom} s/d {dateTo} — saldo kas = kas masuk - kas keluar
          </p>
        </div>
        <OperationalFilters
          dateFrom={dateFrom}
          dateTo={dateTo}
          categories={[]}
          currentCategoryId=""
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kas masuk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-green-600">
              {formatRupiah(summary.inflow)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kas keluar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-destructive">
              {formatRupiah(summary.outflow)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo kas (periode)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold ${
                summary.balance < 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {formatRupiah(summary.balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FlowTable
          title="Kas masuk"
          rows={summary.inflows.map((row) => ({
            label: row.label,
            entries: row.entries,
            amount: row.amount,
          }))}
          emptyText="Tidak ada kas masuk pada periode ini"
          total={summary.inflow}
        />
        <FlowTable
          title="Kas keluar"
          rows={summary.outflows.map((row) => ({
            label: row.label,
            entries: row.entries,
            amount: row.amount,
          }))}
          emptyText="Tidak ada kas keluar pada periode ini"
          total={summary.outflow}
        />
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { PrintReceiptButton } from "@/modules/sales/presentation/components/print-receipt-button";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { formatDateTimeJakarta } from "@/shared/lib/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Shift — POS DNAE",
};

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requirePermission("report.view");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const { id } = await params;
  const container = await getAppContainer();
  const result = await container.shifts.getShiftSummary.execute(id);
  if (isErr(result)) {
    throw new Error(result.error.message);
  }
  const summary = result.data;
  if (!summary) {
    notFound();
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rekap shift</h1>
          <p className="text-sm text-muted-foreground">
            Dibuka {formatDateTimeJakarta(summary.shift.openedAt)}
            {summary.shift.closedAt
              ? ` • Ditutup ${formatDateTimeJakarta(summary.shift.closedAt)}`
              : " • Masih terbuka"}
          </p>
        </div>
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/laporan/shift">Kembali</Link>
        </Button>
      </div>

      <div className="receipt-print-area grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span>Modal awal</span>
              <span>{formatRupiah(summary.shift.openingCash.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Penjualan tunai</span>
              <span>{formatRupiah(summary.cashSales.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Kas masuk</span>
              <span>{formatRupiah(summary.cashIn.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Kas keluar</span>
              <span>-{formatRupiah(summary.cashOut.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Kembalian</span>
              <span>-{formatRupiah(summary.changeGiven.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Refund tunai</span>
              <span>-{formatRupiah(summary.refundsCash.amount)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Ekspektasi</span>
              <span>{formatRupiah(summary.expectedCash.amount)}</span>
            </div>
            {summary.closingCash && (
              <>
                <div className="flex justify-between">
                  <span>Uang fisik</span>
                  <span>{formatRupiah(summary.closingCash.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Selisih</span>
                  <span
                    className={
                      summary.difference && summary.difference.amount !== 0
                        ? "text-destructive"
                        : ""
                    }
                  >
                    {summary.difference
                      ? formatRupiah(summary.difference.amount)
                      : "-"}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Penjualan per metode ({summary.transactions} transaksi)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.byMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada penjualan
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metode</TableHead>
                      <TableHead className="text-right">Trx</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.byMethod.map((m) => (
                      <TableRow key={m.methodName}>
                        <TableCell>{m.methodName}</TableCell>
                        <TableCell className="text-right">
                          {m.transactions}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatRupiah(m.total.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="mt-2">
              <Badge
                variant={
                  summary.shift.status === "open" ? "default" : "secondary"
                }
              >
                {summary.shift.status === "open" ? "Terbuka" : "Tertutup"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <PrintReceiptButton />
      </div>
    </div>
  );
}

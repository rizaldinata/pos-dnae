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
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { ExportButtons } from "@/modules/reporting/presentation/components/export-buttons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Laporan Stok — POS DNAE",
};

export default async function StockReportPage() {
  const guard = await requirePermission("report.view");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const result = await container.reporting.getStockValuation.execute();
  if (isErr(result)) {
    throw new Error(result.error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">
            Laporan Stok &amp; Nilai Persediaan
          </h1>
          <p className="text-sm text-muted-foreground">
            Total nilai: {formatRupiah(result.data.totalValue)}
          </p>
        </div>
        <ExportButtons type="stok" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nilai per varian (qty × harga modal)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Hrg modal</TableHead>
                  <TableHead className="text-right">Nilai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.rows.map((row) => (
                  <TableRow key={row.variantId}>
                    <TableCell className="font-medium">
                      {row.productName}
                      {row.variantName ? ` — ${row.variantName}` : ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.sku}
                    </TableCell>
                    <TableCell className="text-right">{row.qty}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(row.costPrice)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatRupiah(row.stockValue)}
                    </TableCell>
                  </TableRow>
                ))}
                {result.data.rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      Belum ada data stok
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

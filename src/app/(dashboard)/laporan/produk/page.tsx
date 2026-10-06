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
  title: "Laporan Produk — POS DNAE",
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00+07:00`);
  d.setDate(d.getDate() + days);
  return toISODateJakarta(d);
}

export default async function ProductReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; categoryId?: string }>;
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
  const categoryId = params.categoryId ?? "";

  const container = await getAppContainer();
  const [reportResult, categoriesResult] = await Promise.all([
    container.reporting.getOperationalReport.execute({
      dateFrom,
      dateTo,
      categoryId: categoryId || null,
    }),
    container.catalog.listCategories.execute(),
  ]);
  if (isErr(reportResult)) {
    throw new Error(reportResult.error.message);
  }
  if (isErr(categoriesResult)) {
    throw new Error("Gagal memuat kategori");
  }
  const report = reportResult.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Laporan Produk & Kategori</h1>
          <p className="text-sm text-muted-foreground">
            {report.from} s/d {report.to}
          </p>
        </div>
        <ExportButtons
          type="penjualan-produk"
          query={{ from: dateFrom, to: dateTo, categoryId }}
        />
      </div>

      <OperationalFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        categories={categoriesResult.data.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        currentCategoryId={categoryId}
        showCategory
      />

      <Card>
        <CardHeader>
          <CardTitle>Penjualan per kategori</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Pendapatan</TableHead>
                  <TableHead className="text-right">Kontribusi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.categorySales.map((c) => (
                  <TableRow key={c.categoryId ?? "none"}>
                    <TableCell className="font-medium">
                      {c.categoryName}
                    </TableCell>
                    <TableCell className="text-right">{c.qtySold}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(c.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.sharePercent}%
                    </TableCell>
                  </TableRow>
                ))}
                {report.categorySales.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
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

      <Card>
        <CardHeader>
          <CardTitle>Penjualan per produk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Pendapatan</TableHead>
                  <TableHead className="text-right">Rata-rata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.productSales.map((p) => (
                  <TableRow key={`${p.variantId ?? p.productId}`}>
                    <TableCell className="font-medium">
                      {p.productName}
                      {p.variantName ? ` — ${p.variantName}` : ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="text-right">{p.qtySold}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(p.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(p.avgPrice)}
                    </TableCell>
                  </TableRow>
                ))}
                {report.productSales.length === 0 && (
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

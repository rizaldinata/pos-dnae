import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { OperationalFilters } from "@/modules/reporting/presentation/components/operational-filters";
import { ProductProfitChart } from "@/modules/reporting/presentation/components/product-profit-chart";
import { ExportButtons } from "@/modules/reporting/presentation/components/export-buttons";
import type { ProfitSortKey } from "@/modules/reporting/domain/entities/advanced-report";
import { toISODateJakarta } from "@/shared/lib/date";
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
  title: "Laba Per Produk — POS DNAE",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SORT_KEYS: ProfitSortKey[] = [
  "profit",
  "margin",
  "qty",
  "revenue",
  "name",
];

function SortLink({
  label,
  sortKey,
  current,
  query,
}: {
  label: string;
  sortKey: ProfitSortKey;
  current: ProfitSortKey;
  query: string;
}) {
  const active = current === sortKey;
  const arrow = active ? (sortKey === "name" ? " ↑" : " ↓") : "";
  const href = `/laporan/laba/produk?${query}&sort=${sortKey}`;
  return (
    <Link
      href={href}
      className={`hover:underline ${active ? "font-semibold" : "text-muted-foreground"}`}
    >
      {label}
      {arrow}
    </Link>
  );
}

export default async function ProductProfitPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    categoryId?: string;
    sort?: string;
  }>;
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
  const categoryId = params.categoryId ?? "";
  const sort: ProfitSortKey =
    params.sort && (SORT_KEYS as string[]).includes(params.sort)
      ? (params.sort as ProfitSortKey)
      : "profit";

  const container = await getAppContainer();
  const [result, categoriesResult] = await Promise.all([
    container.reporting.getProductProfit.execute({
      dateFrom,
      dateTo,
      categoryId: categoryId || null,
      sort,
    }),
    container.catalog.listCategories.execute(),
  ]);
  if (isErr(result)) {
    throw new Error(result.error.message);
  }
  if (isErr(categoriesResult)) {
    throw new Error("Gagal memuat kategori");
  }
  const report = result.data;

  const baseQuery = `from=${report.from}&to=${report.to}${
    report.categoryId ? `&categoryId=${report.categoryId}` : ""
  }`;
  const totalQty = report.rows.reduce((sum, r) => sum + r.qtySold, 0);
  const totalRevenue = report.rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalCogs = report.rows.reduce((sum, r) => sum + r.cogs, 0);
  const totalProfit = report.rows.reduce((sum, r) => sum + r.profit, 0);
  const totalMargin =
    totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Laba per produk</h1>
          <p className="text-sm text-muted-foreground">
            Pendapatan - HPP (cost_price × qty) ({report.from} s/d {report.to})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/laporan/laba/periode">
            <Button variant="outline" size="sm">
              Laba Periode
            </Button>
          </Link>
          <ExportButtons
            type="laba-produk"
            query={{
              from: report.from,
              to: report.to,
              categoryId: report.categoryId ?? "",
              sort: report.sort,
            }}
          />
        </div>
      </div>

      <OperationalFilters
        dateFrom={report.from}
        dateTo={report.to}
        categories={categoriesResult.data.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        currentCategoryId={categoryId}
        showCategory
      />

      <ProductProfitChart rows={report.rows} />

      <Card>
        <CardHeader>
          <CardTitle>Rincian per produk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortLink
                      label="Produk"
                      sortKey="name"
                      current={sort}
                      query={baseQuery}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortLink
                      label="Qty"
                      sortKey="qty"
                      current={sort}
                      query={baseQuery}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortLink
                      label="Pendapatan"
                      sortKey="revenue"
                      current={sort}
                      query={baseQuery}
                    />
                  </TableHead>
                  <TableHead className="text-right">HPP</TableHead>
                  <TableHead className="text-right">
                    <SortLink
                      label="Laba"
                      sortKey="profit"
                      current={sort}
                      query={baseQuery}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortLink
                      label="Margin %"
                      sortKey="margin"
                      current={sort}
                      query={baseQuery}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.productId}>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell className="text-right">{row.qtySold}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(row.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(row.cogs)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${row.profit < 0 ? "text-destructive" : ""}`}
                    >
                      {formatRupiah(row.profit)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.marginPercent}%
                    </TableCell>
                  </TableRow>
                ))}
                {report.rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      Tidak ada penjualan pada periode ini
                    </TableCell>
                  </TableRow>
                )}
                {report.rows.length > 0 && (
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{totalQty}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(totalCogs)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${totalProfit < 0 ? "text-destructive" : ""}`}
                    >
                      {formatRupiah(totalProfit)}
                    </TableCell>
                    <TableCell className="text-right">{totalMargin}%</TableCell>
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

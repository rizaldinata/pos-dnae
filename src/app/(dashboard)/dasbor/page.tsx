import Link from "next/link";
import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { SalesChart } from "@/modules/reporting/presentation/components/sales-chart";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { formatDateTimeJakarta, toISODateJakarta } from "@/shared/lib/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dasbor",
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00+07:00`);
  d.setDate(d.getDate() + days);
  return toISODateJakarta(d);
}

export default async function DashboardHomePage() {
  const container = await getAppContainer();
  const result = await container.iam.getCurrentUser.execute();
  const user = !isErr(result) ? result.data : null;
  const name = user?.fullName ?? "Pengguna";
  const canSeeReports = user?.hasPermission("report.view") ?? false;

  const lowStockResult = await container.inventory.getLowStockItems.execute(5);
  const lowStock = isErr(lowStockResult) ? null : lowStockResult.data;
  const expiringResult = await container.inventory.getExpiringBatches.execute({
    pageSize: 5,
  });
  const expiring = isErr(expiringResult) ? null : expiringResult.data;

  if (!canSeeReports) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Selamat datang, {name}</h1>
          <p className="text-sm text-muted-foreground">
            Mulai shift dan layani pelanggan
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Kasir</CardTitle>
              <CardDescription>Mulai transaksi baru</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="min-h-11 w-full">
                <Link href="/kasir">Buka kasir</Link>
              </Button>
            </CardContent>
          </Card>
          <LowStockCard lowStock={lowStock} />
          <ExpiryWarningCard expiring={expiring} />
        </div>
      </div>
    );
  }

  const today = toISODateJakarta(new Date());
  const weekAgo = addDays(today, -6);
  const [todayResult, weekResult, topResult, recentResult] = await Promise.all([
    container.reporting.getSalesReport.execute({ mode: "daily", date: today }),
    container.reporting.getSalesReport.execute({
      mode: "range",
      dateFrom: weekAgo,
      dateTo: today,
    }),
    container.reporting.getOperationalReport.execute({
      dateFrom: weekAgo,
      dateTo: today,
    }),
    container.reporting.getRecentTransactions.execute(today, today, 5),
  ]);

  if (
    isErr(todayResult) ||
    isErr(weekResult) ||
    isErr(topResult) ||
    isErr(recentResult)
  ) {
    throw new Error("Gagal memuat dasbor");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Selamat datang, {name}</h1>
          <p className="text-sm text-muted-foreground">
            Penjualan hari ini, {today}
          </p>
        </div>
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/laporan/penjualan">Laporan lengkap</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Penjualan hari ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatRupiah(todayResult.data.totals.netSales)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transaksi hari ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {todayResult.data.totals.transactions}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rata-rata keranjang
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatRupiah(todayResult.data.totals.averagePerTransaction)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Item terjual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {todayResult.data.totals.itemsSold}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SalesChart
            data={weekResult.data.days.map((d) => ({
              day: d.day,
              label: d.day.slice(8, 10),
              netSales: d.netSales,
              transactions: d.transactions,
            }))}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Produk terlaris (7 hari)</CardTitle>
          </CardHeader>
          <CardContent>
            {topResult.data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada penjualan.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {topResult.data.topProducts.slice(0, 10).map((p, index) => (
                  <li
                    key={p.productId}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate">
                      <span className="mr-2 font-semibold text-muted-foreground">
                        {index + 1}.
                      </span>
                      {p.productName}
                    </span>
                    <span className="shrink-0 font-medium">
                      {formatRupiah(p.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Transaksi terbaru</CardTitle>
            </CardHeader>
            <CardContent>
              {recentResult.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada transaksi hari ini.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Waktu</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentResult.data.map((t) => (
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <LowStockCard lowStock={lowStock} />
        <ExpiryWarningCard expiring={expiring} />
      </div>
    </div>
  );
}

function LowStockCard({
  lowStock,
}: {
  lowStock: {
    items: { variantId: string; productName: string; qty: number }[];
    total: number;
  } | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stok menipis</CardTitle>
        <CardDescription>
          {lowStock && lowStock.total > 0
            ? `${lowStock.total} varian perlu restock`
            : "Semua stok aman"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lowStock && lowStock.items.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {lowStock.items.map((item) => (
              <li
                key={item.variantId}
                className="flex items-center justify-between text-sm"
              >
                <Link
                  href={`/stok/${item.variantId}`}
                  className="truncate hover:underline"
                >
                  {item.productName}
                </Link>
                <Badge variant="destructive">{item.qty}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tidak ada stok menipis atau habis.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ExpiryWarningCard({
  expiring,
}: {
  expiring: {
    items: {
      variantId: string;
      productName: string;
      sku: string;
      batchNo: string;
      expiryDate: string;
      status: "expired" | "expiring";
    }[];
    total: number;
  } | null;
}) {
  const hasWarning = expiring !== null && expiring.total > 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Peringatan kedaluwarsa</CardTitle>
        <CardDescription>
          {hasWarning
            ? `${expiring.total} batch kedaluwarsa / mendekati`
            : "Tidak ada batch bermasalah"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasWarning ? (
          <ul className="flex flex-col gap-1">
            {expiring.items.map((item) => (
              <li
                key={`${item.variantId}-${item.batchNo}-${item.expiryDate}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <Link
                  href={`/stok/${item.variantId}`}
                  className="truncate hover:underline"
                >
                  {item.productName}
                </Link>
                <Badge
                  variant={
                    item.status === "expired" ? "destructive" : "secondary"
                  }
                  className={
                    item.status === "expiring"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : undefined
                  }
                >
                  {item.status === "expired"
                    ? "Kedaluwarsa"
                    : item.expiryDate.slice(5)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tidak ada item mendekati kedaluwarsa.
          </p>
        )}
        <Button variant="outline" size="sm" asChild className="mt-3 w-full">
          <Link href="/stok/kedaluwarsa">Lihat semua</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

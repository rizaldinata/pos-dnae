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
import { StockMovementTypeFilter } from "@/modules/inventory/presentation/components/stock-movement-type-filter";
import { StockMovementChart } from "@/modules/inventory/presentation/components/stock-movement-chart";
import { isStockMovementType } from "@/modules/inventory/domain/entities/stock";
import { classifyExpiry } from "@/modules/inventory/domain/services/expiry-policy";
import { toISODateJakarta } from "@/shared/lib/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kartu Stok",
};

const PAGE_SIZE = 20;

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

export default async function StockCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ variantId: string }>;
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    const stockGuard = await requirePermission("stock.manage");
    if (!stockGuard.ok) {
      redirect("/forbidden");
    }
  }

  const { variantId } = await params;
  const query = await searchParams;
  const type =
    query.type && isStockMovementType(query.type) ? query.type : undefined;
  const page = Math.max(Number(query.page) || 1, 1);

  const container = await getAppContainer();
  const [result, settingsResult] = await Promise.all([
    container.inventory.getStockCard.execute({
      variantId,
      type,
      page,
      pageSize: PAGE_SIZE,
    }),
    container.settings.getInventorySettings.execute(),
  ]);

  if (isErr(result)) {
    throw new Error(result.error.message);
  }
  const { overview, movements, total, batches } = result.data;
  if (!overview) {
    notFound();
  }
  const warningDays = isErr(settingsResult)
    ? 30
    : settingsResult.data.expiryWarningDays;
  const today = toISODateJakarta();

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const chartPoints = movements.map((m) => ({
    id: m.id,
    createdAt: formatDateTime(m.createdAt),
    label: formatDateTime(m.createdAt).slice(0, 6),
    balanceAfter: m.balanceAfter,
    qtyChange: m.qtyChange,
  }));

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div>
        <Link
          href="/stok"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Kembali ke daftar stok
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {overview.productName}
          {overview.variantName ? ` — ${overview.variantName}` : ""}
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          {overview.sku}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stok saat ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overview.qty}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stok minimum
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overview.minStock}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={overview.status === "normal" ? "default" : "destructive"}
            >
              {overview.status === "normal"
                ? "Normal"
                : overview.status === "menipis"
                  ? "Menipis"
                  : "Habis"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {batches && batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batch aktif</CardTitle>
            <p className="text-sm text-muted-foreground">
              Urut FEFO — batch paling cepat kedaluwarsa terpakai lebih dulu
            </p>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1">
              {batches.map((batch) => {
                const status = batch.expiryDate
                  ? classifyExpiry(batch.expiryDate, warningDays, today)
                  : "ok";
                return (
                  <li
                    key={batch.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate font-mono text-xs">
                      {batch.batchNo || "(tanpa no. batch)"}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-muted-foreground">
                        {batch.expiryDate ?? "tanpa kedaluwarsa"}
                      </span>
                      {status === "expired" ? (
                        <Badge variant="destructive">Kedaluwarsa</Badge>
                      ) : status === "expiring" ? (
                        <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400">
                          Mendekati
                        </Badge>
                      ) : null}
                      <Badge variant="secondary">{batch.qty}</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Riwayat pergerakan ({total})</h2>
        <StockMovementTypeFilter currentType={query.type ?? ""} />
      </div>

      {!type && <StockMovementChart points={chartPoints} />}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead className="text-right">Perubahan</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Referensi</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(m.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{m.typeLabel}</Badge>
                </TableCell>
                <TableCell
                  className={`text-right font-medium ${m.qtyChange > 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange}
                </TableCell>
                <TableCell className="text-right">{m.balanceAfter}</TableCell>
                <TableCell>
                  {m.refType === "sale" && m.refId ? (
                    <Link
                      href={`/laporan/transaksi/${m.refId}`}
                      className="text-xs hover:underline"
                    >
                      Transaksi
                    </Link>
                  ) : m.refType === "opname" && m.refId ? (
                    <Link
                      href={`/stok/opname/${m.refId}`}
                      className="text-xs hover:underline"
                    >
                      Opname
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {m.batchId ? (
                    <span className="text-xs">
                      {m.batchNo || "-"}
                      {m.batchExpiryDate && (
                        <span className="block text-muted-foreground">
                          {m.batchExpiryDate}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">
                  {m.note || "-"}
                </TableCell>
              </TableRow>
            ))}
            {movements.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Belum ada pergerakan stok
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild disabled={page <= 1}>
              <Link
                href={`/stok/${variantId}?page=${page - 1}${type ? `&type=${type}` : ""}`}
              >
                Sebelumnya
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page >= totalPages}
            >
              <Link
                href={`/stok/${variantId}?page=${page + 1}${type ? `&type=${type}` : ""}`}
              >
                Berikutnya
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

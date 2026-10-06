import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
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

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kedaluwarsa — POS DNAE",
};

const PAGE_SIZE = 20;

function pageHref(
  params: Record<string, string | undefined>,
  page: number
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }
  if (page > 1) {
    search.set("page", String(page));
  }
  const qs = search.toString();
  return `/stok/kedaluwarsa${qs ? `?${qs}` : ""}`;
}

export default async function ExpiringStockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    const stockGuard = await requirePermission("stock.manage");
    if (!stockGuard.ok) {
      redirect("/forbidden");
    }
  }

  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : "";
  const status =
    rawStatus === "expired" || rawStatus === "expiring" ? rawStatus : undefined;
  const page = Math.max(Number(params.page) || 1, 1);

  const container = await getAppContainer();
  const [batchesResult, settingsResult] = await Promise.all([
    container.inventory.getExpiringBatches.execute({
      status,
      page,
      pageSize: PAGE_SIZE,
    }),
    container.settings.getInventorySettings.execute(),
  ]);

  if (isErr(batchesResult)) {
    throw new Error(batchesResult.error.message);
  }
  const warningDays = isErr(settingsResult)
    ? 30
    : settingsResult.data.expiryWarningDays;

  const { items, total } = batchesResult.data;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const baseParams = { status: rawStatus || undefined };
  const expiredCount = items.filter((i) => i.status === "expired").length;

  const tabs = [
    { key: "", label: "Semua" },
    { key: "expiring", label: "Mendekati" },
    { key: "expired", label: "Kedaluwarsa" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Kedaluwarsa</h1>
          <p className="text-sm text-muted-foreground">
            {total} batch — peringatan {warningDays} hari sebelum tanggal
            kedaluwarsa
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="min-h-11">
            <Link href="/pengaturan/inventori">Atur peringatan</Link>
          </Button>
          <Button variant="outline" asChild className="min-h-11">
            <Link href="/stok">Kembali ke stok</Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={(rawStatus || "") === tab.key ? "default" : "outline"}
            size="sm"
            asChild
            className="min-h-11"
          >
            <Link href={pageHref({ status: tab.key || undefined }, 1)}>
              {tab.label}
            </Link>
          </Button>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produk</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead className="text-right">Sisa stok</TableHead>
              <TableHead>Kedaluwarsa</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/stok/${item.variantId}`}
                    className="hover:underline"
                  >
                    {item.productName}
                    {item.variantName ? ` — ${item.variantName}` : ""}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                <TableCell className="text-xs">
                  {item.batchNo || (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">{item.qty}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {item.expiryDate}
                </TableCell>
                <TableCell>
                  {item.status === "expired" ? (
                    <Badge variant="destructive">Kedaluwarsa</Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400">
                      Mendekati
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  {status === "expired" && expiredCount === 0
                    ? "Tidak ada batch kedaluwarsa — bagus!"
                    : "Tidak ada batch mendekati kedaluwarsa."}
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
              <Link href={pageHref(baseParams, page - 1)}>Sebelumnya</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page >= totalPages}
            >
              <Link href={pageHref(baseParams, page + 1)}>Berikutnya</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

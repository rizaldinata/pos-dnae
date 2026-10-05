import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { ProductSearch } from "@/modules/catalog/presentation/components/product-search";
import { StockFilters } from "@/modules/inventory/presentation/components/stock-filters";
import type { StockStatus } from "@/modules/inventory/domain/services/stock-policy";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Stok — POS DNAE",
};

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<StockStatus, string> = {
  normal: "Normal",
  menipis: "Menipis",
  habis: "Habis",
};

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
  const query = search.toString();
  return `/stok${query ? `?${query}` : ""}`;
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    const stockGuard = await requirePermission("stock.manage");
    if (!stockGuard.ok) {
      redirect("/forbidden");
    }
  }

  const params = await searchParams;
  const query = params.q ?? "";
  const categoryId = params.categoryId ?? "";
  const status = (params.status as StockStatus | undefined) ?? undefined;
  const page = Math.max(Number(params.page) || 1, 1);

  const container = await getAppContainer();
  const [overviewResult, categoriesResult] = await Promise.all([
    container.inventory.listStockOverview.execute({
      query,
      categoryId: categoryId || undefined,
      status:
        status === "normal" || status === "menipis" || status === "habis"
          ? status
          : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    container.catalog.listCategories.execute(),
  ]);

  if (isErr(overviewResult)) {
    throw new Error(overviewResult.error.message);
  }
  if (isErr(categoriesResult)) {
    throw new Error("Gagal memuat kategori");
  }

  const { items, total } = overviewResult.data;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const baseParams = {
    q: query || undefined,
    categoryId: categoryId || undefined,
    status: params.status || undefined,
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Stok</h1>
        <p className="text-sm text-muted-foreground">{total} varian</p>
      </div>

      <div className="flex flex-col gap-2">
        <ProductSearch initialQuery={query} />
        <StockFilters
          categories={categoriesResult.data.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
          currentCategoryId={categoryId}
          currentStatus={params.status ?? ""}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produk</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.variantId}>
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
                <TableCell>{item.categoryName ?? "-"}</TableCell>
                <TableCell className="text-right">
                  {item.trackStock ? item.qty : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {item.trackStock ? item.minStock : "-"}
                </TableCell>
                <TableCell>
                  {!item.trackStock ? (
                    <Badge variant="secondary">Tidak dilacak</Badge>
                  ) : (
                    <Badge
                      variant={
                        item.status === "normal" ? "default" : "destructive"
                      }
                    >
                      {STATUS_LABEL[item.status]}
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
                  Tidak ada data stok
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

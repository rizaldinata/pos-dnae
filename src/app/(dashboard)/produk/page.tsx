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
import { ProductFilters } from "@/modules/catalog/presentation/components/product-filters";
import { ExportButtons } from "@/modules/reporting/presentation/components/export-buttons";
import { formatRupiah } from "@/shared/lib/format-rupiah";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Produk",
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
  const query = search.toString();
  return `/produk${query ? `?${query}` : ""}`;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    brandId?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const query = params.q ?? "";
  const categoryId = params.categoryId ?? "";
  const brandId = params.brandId ?? "";
  const status = params.status ?? "";
  const page = Math.max(Number(params.page) || 1, 1);

  const container = await getAppContainer();
  const [productsResult, categoriesResult, brandsResult] = await Promise.all([
    container.catalog.listProducts.execute({
      query,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      isActive:
        status === "aktif" ? true : status === "nonaktif" ? false : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    container.catalog.listCategories.execute(),
    container.catalog.listBrands.execute(),
  ]);

  if (isErr(productsResult)) {
    throw new Error(productsResult.error.message);
  }
  if (isErr(categoriesResult) || isErr(brandsResult)) {
    throw new Error("Gagal memuat data master");
  }

  const { items, total } = productsResult.data;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const baseParams = {
    q: query || undefined,
    categoryId: categoryId || undefined,
    brandId: brandId || undefined,
    status: status || undefined,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Produk</h1>
          <p className="text-sm text-muted-foreground">
            {total} produk{query ? ` untuk "${query}"` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild className="min-h-11">
            <Link href="/produk/kategori">Kategori</Link>
          </Button>
          <Button variant="outline" asChild className="min-h-11">
            <Link href="/produk/impor">Impor</Link>
          </Button>
          <Button variant="outline" asChild className="min-h-11">
            <Link href="/produk/label">Cetak Label</Link>
          </Button>
          <Button asChild className="min-h-11">
            <Link href="/produk/baru">Tambah produk</Link>
          </Button>
          <ExportButtons
            type="produk"
            csv
            query={{
              q: query || undefined,
              categoryId: categoryId || undefined,
              brandId: brandId || undefined,
              status: status || undefined,
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <ProductSearch initialQuery={query} />
        <ProductFilters
          categories={categoriesResult.data.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
          brands={brandsResult.data.map((b) => ({ id: b.id, name: b.name }))}
          currentCategoryId={categoryId}
          currentBrandId={brandId}
          currentStatus={status}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Foto</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Harga</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((product) => {
              const first = product.defaultVariant();
              const totalStock = product.variants.reduce(
                (sum, v) => sum + (v.stockQty ?? 0),
                0
              );
              const lowStock = product.variants.some((v) => v.isLowStock());
              return (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-10 w-10 rounded-md border object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/produk/${product.id}`}
                      className="hover:underline"
                    >
                      {product.name}
                    </Link>
                    {product.variants.length > 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({product.variants.length} varian)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {first?.sku.value ?? "-"}
                  </TableCell>
                  <TableCell>{product.categoryName ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    {first ? formatRupiah(first.sellPrice.amount) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {lowStock ? (
                      <Badge variant="destructive">{totalStock}</Badge>
                    ) : (
                      totalStock
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? "default" : "secondary"}>
                      {product.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Tidak ada produk ditemukan
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

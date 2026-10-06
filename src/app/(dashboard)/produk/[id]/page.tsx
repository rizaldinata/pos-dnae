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
import { DeleteProductButton } from "@/modules/catalog/presentation/components/delete-product-button";
import { BarcodeSvg } from "@/modules/catalog/presentation/components/barcode-svg";
import { formatRupiah } from "@/shared/lib/format-rupiah";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const container = await getAppContainer();
  const result = await container.catalog.getProduct.execute(id);
  if (isErr(result)) {
    return { title: "Produk — POS DNAE" };
  }
  return { title: `${result.data.name} — POS DNAE` };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const { id } = await params;
  const container = await getAppContainer();
  const result = await container.catalog.getProduct.execute(id);
  if (isErr(result)) {
    throw new Error(result.error.message);
  }
  if (result.data === null) {
    notFound();
  }
  const product = result.data;

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[product.categoryName, product.brandName, product.unitShortName]
              .filter(Boolean)
              .join(" • ") || "Tanpa kategori"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="min-h-11">
            <Link href={`/produk/${product.id}/ubah`}>Ubah</Link>
          </Button>
          <DeleteProductButton
            productId={product.id}
            productName={product.name}
          />
        </div>
      </div>

      {product.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-40 w-40 rounded-md border object-cover"
        />
      )}
      <div className="flex gap-2">
        <Badge variant={product.isActive ? "default" : "secondary"}>
          {product.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
        {product.description && (
          <span className="text-sm text-muted-foreground">
            {product.description}
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Varian ({product.variants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Varian</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead className="text-right">Hrg modal</TableHead>
                  <TableHead className="text-right">Hrg jual</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">
                      {v.variantName || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.sku.value}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {v.barcode ?? "-"}
                      {v.barcode && (
                        <div className="mt-1 w-32">
                          <BarcodeSvg value={v.barcode} showText={false} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(v.costPrice.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(v.sellPrice.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {v.trackStock ? (
                        v.isLowStock() ? (
                          <Badge variant="destructive">{v.stockQty}</Badge>
                        ) : (
                          (v.stockQty ?? 0)
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

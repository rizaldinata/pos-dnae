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
import { POActions } from "@/modules/purchasing/presentation/components/po-actions";
import { ReceiveGoodsDialog } from "@/modules/purchasing/presentation/components/receive-goods-dialog";
import { formatRupiah } from "@/shared/lib/format-rupiah";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail PO",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Terkirim",
  partial: "Sebagian",
  completed: "Selesai",
  cancelled: "Batal",
};

export default async function PODetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requirePermission("purchasing.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const { id } = await params;
  const container = await getAppContainer();
  const [poResult, receiptsResult] = await Promise.all([
    container.purchasing.getPO.execute(id),
    container.purchasing.listReceipts.execute(id),
  ]);
  if (isErr(poResult)) {
    throw new Error(poResult.error.message);
  }
  if (poResult.data === null) {
    notFound();
  }
  if (isErr(receiptsResult)) {
    throw new Error(receiptsResult.error.message);
  }
  const po = poResult.data;
  const receipts = receiptsResult.data;

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{po.poNo}</h1>
            <Badge
              variant={po.status === "completed" ? "default" : "secondary"}
            >
              {STATUS_LABEL[po.status] ?? po.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {po.supplierName ?? "-"} • {po.orderDate}
          </p>
        </div>
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/pembelian/po">Kembali</Link>
        </Button>
      </div>

      {po.notes && (
        <p className="text-sm text-muted-foreground">Catatan: {po.notes}</p>
      )}

      <POActions poId={po.id} status={po.status} canCancel={po.canCancel()} />

      <Card>
        <CardHeader>
          <CardTitle>Item PO</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty pesan</TableHead>
                  <TableHead className="text-right">Diterima</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.productName}
                      {item.variantName ? ` — ${item.variantName}` : ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.sku}
                    </TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell className="text-right">
                      {item.receivedQty}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(item.costPrice.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(item.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-2 flex justify-between font-semibold">
            <span>Total PO</span>
            <span>{formatRupiah(po.total.amount)}</span>
          </div>
        </CardContent>
      </Card>

      {receipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat penerimaan</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {receipts.map((gr) => (
                <li key={gr.id} className="flex justify-between">
                  <span className="font-mono">{gr.grNo}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {po.canReceive() && (
        <ReceiveGoodsDialog
          poId={po.id}
          items={po.items
            .filter((item) => item.remainingQty > 0)
            .map((item) => ({
              variantId: item.variantId,
              displayName: item.variantName
                ? `${item.productName} — ${item.variantName}`
                : item.productName,
              sku: item.sku,
              remaining: item.remainingQty,
              costPrice: item.costPrice.amount,
            }))}
        />
      )}
    </div>
  );
}

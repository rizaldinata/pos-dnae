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
import { formatRupiah } from "@/shared/lib/format-rupiah";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Purchase Order — POS DNAE",
};

const PAGE_SIZE = 20;
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Terkirim",
  partial: "Sebagian",
  completed: "Selesai",
  cancelled: "Batal",
};

export default async function POListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const guard = await requirePermission("purchasing.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const status = params.status ?? "";
  const page = Math.max(Number(params.page) || 1, 1);

  const container = await getAppContainer();
  const result = await container.purchasing.listPOs.execute({
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  if (isErr(result)) {
    throw new Error(result.error.message);
  }
  const { items, total } = result.data;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Order</h1>
          <p className="text-sm text-muted-foreground">{total} PO</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="min-h-11">
            <Link href="/pembelian/supplier">Supplier</Link>
          </Button>
          <Button variant="outline" asChild className="min-h-11">
            <Link href="/pembelian/retur">Retur</Link>
          </Button>
          <Button variant="outline" asChild className="min-h-11">
            <Link href="/pembelian/hutang">Hutang</Link>
          </Button>
          <Button asChild className="min-h-11">
            <Link href="/pembelian/po/baru">Buat PO</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "draft", "sent", "partial", "completed", "cancelled"].map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href={`/pembelian/po${s ? `?status=${s}` : ""}`}>
              {s === "" ? "Semua" : STATUS_LABEL[s]}
            </Link>
          </Button>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. PO</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/pembelian/po/${po.id}`}
                    className="hover:underline"
                  >
                    {po.poNo}
                  </Link>
                </TableCell>
                <TableCell>{po.supplierName ?? "-"}</TableCell>
                <TableCell className="text-right">
                  {formatRupiah(po.total.amount)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      po.status === "completed" ? "default" : "secondary"
                    }
                  >
                    {STATUS_LABEL[po.status] ?? po.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  Belum ada PO
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
                href={`/pembelian/po?page=${page - 1}${status ? `&status=${status}` : ""}`}
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
                href={`/pembelian/po?page=${page + 1}${status ? `&status=${status}` : ""}`}
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { formatDateTimeJakarta } from "@/shared/lib/date";
import { listReturnsAction } from "@/modules/sales/presentation/actions/void-return.action";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Riwayat Retur — POS DNAE",
};

const PAGE_SIZE = 20;

export default async function ReturnHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const guard = await requirePermission("report.view");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const page = Math.max(Number(params.page) || 1, 1);

  const { items, total } = await listReturnsAction(page);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Riwayat Retur</h1>
        <p className="text-sm text-muted-foreground">{total} retur tercatat</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Invoice asal</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead>Metode refund</TableHead>
              <TableHead className="text-right">Total refund</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTimeJakarta(item.createdAt)}
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/laporan/transaksi/${item.saleId}`}
                    className="hover:underline"
                  >
                    {item.invoiceNo}
                  </Link>
                </TableCell>
                <TableCell className="max-w-48 truncate">
                  {item.reason}
                </TableCell>
                <TableCell>{item.refundMethodName}</TableCell>
                <TableCell className="text-right">
                  {formatRupiah(item.totalRefund)}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  Belum ada retur
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
              <Link href={`/laporan/retur?page=${page - 1}`}>Sebelumnya</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page >= totalPages}
            >
              <Link href={`/laporan/retur?page=${page + 1}`}>Berikutnya</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

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
import { formatDateTimeJakarta } from "@/shared/lib/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rekap Shift — POS DNAE",
};

const PAGE_SIZE = 20;

export default async function ShiftRecapPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const guard = await requirePermission("report.view");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const page = Math.max(Number(params.page) || 1, 1);
  const status =
    params.status === "open" || params.status === "closed"
      ? params.status
      : undefined;

  const container = await getAppContainer();
  const result = await container.shifts.listShifts.execute({
    status,
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
          <h1 className="text-2xl font-semibold">Rekap Shift</h1>
          <p className="text-sm text-muted-foreground">{total} shift</p>
        </div>
        <div className="flex gap-2">
          <Button variant={!status ? "default" : "outline"} size="sm" asChild>
            <Link href="/laporan/shift">Semua</Link>
          </Button>
          <Button
            variant={status === "open" ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href="/laporan/shift?status=open">Terbuka</Link>
          </Button>
          <Button
            variant={status === "closed" ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link href="/laporan/shift?status=closed">Tertutup</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dibuka</TableHead>
              <TableHead>Ditutup</TableHead>
              <TableHead className="text-right">Modal</TableHead>
              <TableHead className="text-right">Ekspektasi</TableHead>
              <TableHead className="text-right">Fisik</TableHead>
              <TableHead className="text-right">Selisih</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((shift) => (
              <TableRow key={shift.id}>
                <TableCell>
                  <Link
                    href={`/laporan/shift/${shift.id}`}
                    className="hover:underline"
                  >
                    {formatDateTimeJakarta(shift.openedAt)}
                  </Link>
                </TableCell>
                <TableCell>
                  {shift.closedAt ? formatDateTimeJakarta(shift.closedAt) : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {formatRupiah(shift.openingCash.amount)}
                </TableCell>
                <TableCell className="text-right">
                  {shift.expectedCash
                    ? formatRupiah(shift.expectedCash.amount)
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {shift.closingCash
                    ? formatRupiah(shift.closingCash.amount)
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {shift.difference ? (
                    <span
                      className={
                        shift.difference.amount === 0
                          ? ""
                          : shift.difference.amount > 0
                            ? "text-green-600"
                            : "text-destructive"
                      }
                    >
                      {formatRupiah(shift.difference.amount)}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={shift.status === "open" ? "default" : "secondary"}
                  >
                    {shift.status === "open" ? "Terbuka" : "Tertutup"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Belum ada shift
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
                href={`/laporan/shift?page=${page - 1}${status ? `&status=${status}` : ""}`}
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
                href={`/laporan/shift?page=${page + 1}${status ? `&status=${status}` : ""}`}
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

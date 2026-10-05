import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { Badge } from "@/shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { CreateOpnameDialog } from "@/modules/inventory/presentation/components/create-opname-dialog";
import { formatDateTimeJakarta } from "@/shared/lib/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Stock Opname — POS DNAE",
};

export default async function OpnameListPage() {
  const guard = await requirePermission("stock.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const [listResult, categoriesResult] = await Promise.all([
    container.inventory.listOpnames.execute(),
    container.catalog.listCategories.execute(),
  ]);
  if (isErr(listResult)) {
    throw new Error(listResult.error.message);
  }
  if (isErr(categoriesResult)) {
    throw new Error("Gagal memuat kategori");
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock Opname</h1>
          <p className="text-sm text-muted-foreground">
            Audit stok fisik vs sistem
          </p>
        </div>
        <CreateOpnameDialog
          categories={categoriesResult.data.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listResult.data.map((opname) => (
              <TableRow key={opname.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/stok/opname/${opname.id}`}
                    className="hover:underline"
                  >
                    {opname.code}
                  </Link>
                </TableCell>
                <TableCell>{formatDateTimeJakarta(opname.createdAt)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      opname.status === "approved" ? "default" : "secondary"
                    }
                  >
                    {opname.status === "approved"
                      ? "Disetujui"
                      : opname.status === "review"
                        ? "Review"
                        : "Draft"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {listResult.data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground"
                >
                  Belum ada sesi opname
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

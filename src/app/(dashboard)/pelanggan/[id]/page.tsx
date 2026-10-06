import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
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
import { LoyaltyHistory } from "@/modules/customers/presentation/components/loyalty-history";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Pelanggan",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requirePermission("customer.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const { id } = await params;
  const container = await getAppContainer();
  const [customerResult, historyResult, loyaltyResult] = await Promise.all([
    container.customers.getCustomer.execute(id),
    container.customers.getCustomerHistory.execute(id),
    container.customers.getLoyaltyHistory.execute(id, 50),
  ]);

  if (isErr(customerResult)) {
    throw new Error(customerResult.error.message);
  }
  if (customerResult.data === null) {
    notFound();
  }
  if (isErr(historyResult)) {
    throw new Error(historyResult.error.message);
  }
  if (isErr(loyaltyResult)) {
    throw new Error(loyaltyResult.error.message);
  }

  const customer = customerResult.data;
  const history = historyResult.data;

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[customer.phone, customer.email].filter(Boolean).join(" • ") ||
              "Tanpa kontak"}
          </p>
        </div>
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/pelanggan">Kembali</Link>
        </Button>
      </div>

      {customer.address && (
        <p className="text-sm text-muted-foreground">{customer.address}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total belanja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {formatRupiah(history.totalSpent)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transaksi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{history.transactionCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rata-rata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {formatRupiah(history.averagePerTransaction)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Poin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{customer.points}</p>
          </CardContent>
        </Card>
      </div>

      {customer.receivableBalance > 0 && (
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <span className="text-sm font-medium">Saldo piutang</span>
            <Badge variant="destructive">
              {formatRupiah(customer.receivableBalance)}
            </Badge>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat transaksi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/laporan/transaksi/${p.id}`}
                        className="hover:underline"
                      >
                        {p.invoiceNo}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTimeJakarta(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(p.grandTotal)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "completed" ? "default" : "secondary"
                        }
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {history.purchases.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      Belum ada transaksi
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat poin</CardTitle>
        </CardHeader>
        <CardContent>
          <LoyaltyHistory
            customerId={customer.id}
            customerName={customer.name}
            balance={customer.points}
            items={loyaltyResult.data.map((t) => ({
              id: t.id,
              points: t.points,
              type: t.type,
              note: t.note,
              createdAt: t.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

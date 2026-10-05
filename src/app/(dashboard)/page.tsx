import Link from "next/link";
import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dasbor — POS DNAE",
};

export default async function DashboardHomePage() {
  const container = await getAppContainer();
  const result = await container.iam.getCurrentUser.execute();
  const name =
    !isErr(result) && result.data ? result.data.fullName : "Pengguna";

  const lowStockResult = await container.inventory.getLowStockItems.execute(5);
  const lowStock = isErr(lowStockResult) ? null : lowStockResult.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Selamat datang, {name}</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan operasional toko hari ini
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Kasir</CardTitle>
            <CardDescription>Mulai transaksi baru</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="min-h-11 w-full">
              <Link href="/kasir">Buka kasir</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Laporan</CardTitle>
            <CardDescription>Penjualan hari ini</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="min-h-11 w-full">
              <Link href="/laporan/penjualan">Lihat laporan</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stok menipis</CardTitle>
            <CardDescription>
              {lowStock && lowStock.total > 0
                ? `${lowStock.total} varian perlu restock`
                : "Semua stok aman"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lowStock && lowStock.items.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {lowStock.items.map((item) => (
                  <li
                    key={item.variantId}
                    className="flex items-center justify-between text-sm"
                  >
                    <Link
                      href={`/stok/${item.variantId}`}
                      className="truncate hover:underline"
                    >
                      {item.productName}
                    </Link>
                    <Badge variant="destructive">{item.qty}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tidak ada stok menipis atau habis.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

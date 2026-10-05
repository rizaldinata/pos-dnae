import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

export const metadata = {
  title: "Dasbor — POS DNAE",
};

export default async function DashboardHomePage() {
  const container = await getAppContainer();
  const result = await container.iam.getCurrentUser.execute();
  const name =
    !isErr(result) && result.data ? result.data.fullName : "Pengguna";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Selamat datang, {name}</h1>
        <p className="text-sm text-muted-foreground">
          Fondasi aplikasi (Fase 0) selesai. Modul kasir dan operasional
          menyusul di fase berikutnya.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Autentikasi</CardTitle>
            <CardDescription>Status login dan sesi</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Anda masuk dan sesi aktif.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kasir</CardTitle>
            <CardDescription>Transaksi penjualan</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Tahap berikutnya (Fase 1: MVP).</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Laporan</CardTitle>
            <CardDescription>Penjualan dan operasional</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Tahap berikutnya (Fase 1–2).</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

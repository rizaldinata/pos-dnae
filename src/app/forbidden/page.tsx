import Link from "next/link";
import { Button } from "@/shared/ui/button";

export const metadata = {
  title: "Akses Ditolak",
};

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground">403</p>
      <h1 className="text-xl font-semibold">Akses ditolak</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Akun Anda tidak memiliki hak akses untuk membuka halaman ini. Hubungi
        Owner jika Anda merasa ini keliru.
      </p>
      <Button asChild>
        <Link href="/">Kembali ke dasbor</Link>
      </Button>
    </main>
  );
}

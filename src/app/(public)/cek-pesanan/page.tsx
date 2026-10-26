import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CekPesananForm } from "@/modules/orders/presentation/components/storefront/cek-pesanan-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cek Pesanan",
};

export default async function CekPesananPage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string }>;
}) {
  const { no } = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground w-fit"
      >
        <ArrowLeft className="size-4" />
        Kembali ke Beranda
      </Link>
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle>Cek status pesanan</CardTitle>
          <CardDescription>
            Masukkan nomor pesanan dan no. HP yang dipakai saat memesan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CekPesananForm initialOrderNo={no} />
        </CardContent>
      </Card>
    </div>
  );
}

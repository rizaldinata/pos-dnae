import { redirect } from "next/navigation";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { ProductImportWizard } from "@/modules/catalog/presentation/components/product-import-wizard";
import { Button } from "@/shared/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Impor Produk",
};

export default async function ProductImportPage() {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Impor Produk</h1>
        <p className="text-sm text-muted-foreground">
          Unggah file CSV/Excel berdasarkan template, periksa pratinjau, lalu
          konfirmasi impor. (PRD-06)
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href="/api/produk/template?format=csv" download>
          <Button variant="outline">Unduh Template CSV</Button>
        </a>
        <a href="/api/produk/template?format=xlsx" download>
          <Button variant="outline">Unduh Template Excel</Button>
        </a>
        <Button variant="ghost" asChild>
          <Link href="/produk">Kembali ke Daftar Produk</Link>
        </Button>
      </div>
      <ProductImportWizard />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { ProductForm } from "@/modules/catalog/presentation/components/product-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tambah Produk",
};

export default async function NewProductPage() {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const [categoriesResult, brandsResult, unitsResult] = await Promise.all([
    container.catalog.listCategories.execute(),
    container.catalog.listBrands.execute(),
    container.catalog.listUnits.execute(),
  ]);

  if (isErr(categoriesResult) || isErr(brandsResult) || isErr(unitsResult)) {
    throw new Error("Gagal memuat data master");
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Tambah produk</h1>
        <p className="text-sm text-muted-foreground">
          Isi info produk beserta variannya
        </p>
      </div>
      <ProductForm
        mode="create"
        categories={categoriesResult.data.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        brands={brandsResult.data.map((b) => ({ id: b.id, name: b.name }))}
        units={unitsResult.data.map((u) => ({
          id: u.id,
          name: u.name,
          shortName: u.shortName,
        }))}
      />
    </div>
  );
}

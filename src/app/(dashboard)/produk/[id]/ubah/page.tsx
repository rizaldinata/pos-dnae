import { notFound, redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { ProductForm } from "@/modules/catalog/presentation/components/product-form";
import { BundleItemsEditor } from "@/modules/catalog/presentation/components/bundle-items-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ubah Produk",
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const { id } = await params;
  const container = await getAppContainer();
  const [productResult, categoriesResult, brandsResult, unitsResult] =
    await Promise.all([
      container.catalog.getProduct.execute(id),
      container.catalog.listCategories.execute(),
      container.catalog.listBrands.execute(),
      container.catalog.listUnits.execute(),
    ]);

  if (isErr(productResult)) {
    throw new Error(productResult.error.message);
  }
  if (productResult.data === null) {
    notFound();
  }
  if (isErr(categoriesResult) || isErr(brandsResult) || isErr(unitsResult)) {
    throw new Error("Gagal memuat data master");
  }

  const product = productResult.data;

  const bundleItemsResult = product.isBundle
    ? await container.catalog.getBundleItems.execute(product.id)
    : null;
  if (bundleItemsResult && isErr(bundleItemsResult)) {
    throw new Error(bundleItemsResult.error.message);
  }

  const tiersByVariant: Record<string, { minQty: number; price: number }[]> =
    {};
  await Promise.all(
    product.variants.map(async (v) => {
      const tiersResult = await container.catalog.getPriceTiers.execute(v.id);
      if (!tiersResult.success) {
        throw new Error(tiersResult.error.message);
      }
      tiersByVariant[v.id] = tiersResult.data.map((t) => ({
        minQty: t.minQty,
        price: t.price.amount,
      }));
    })
  );

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Ubah produk</h1>
        <p className="text-sm text-muted-foreground">{product.name}</p>
      </div>
      <ProductForm
        mode="edit"
        initial={{
          id: product.id,
          name: product.name,
          categoryId: product.categoryId ?? "",
          brandId: product.brandId ?? "",
          unitId: product.unitId ?? "",
          description: product.description,
          imageUrl: product.imageUrl,
          isActive: product.isActive,
          isBundle: product.isBundle,
          variants: product.variants.map((v) => ({
            id: v.id,
            sku: v.sku.value,
            barcode: v.barcode ?? "",
            variantName: v.variantName,
            costPrice: String(v.costPrice.amount),
            sellPrice: String(v.sellPrice.amount),
            minStock: String(v.minStock),
            trackStock: v.trackStock,
            imageUrl: v.imageUrl,
            tiers: tiersByVariant[v.id] ?? [],
          })),
        }}
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
      {product.isBundle && bundleItemsResult && (
        <BundleItemsEditor
          productId={product.id}
          initial={bundleItemsResult.data}
        />
      )}
    </div>
  );
}

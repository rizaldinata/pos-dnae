import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { Button } from "@/shared/ui/button";
import { PromotionManagement } from "@/modules/promotions/presentation/components/promotion-management";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Promo — POS DNAE",
};

export default async function PromotionsPage() {
  const guard = await requirePermission("promo.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const [promotionsResult, categoriesResult] = await Promise.all([
    container.promotions.listPromotions.execute(),
    container.catalog.listCategories.execute(),
  ]);
  if (isErr(promotionsResult) || isErr(categoriesResult)) {
    throw new Error("Gagal memuat data promo");
  }

  const categories = categoriesResult.data.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const categoryNames = Object.fromEntries(
    categories.map((c) => [c.id, c.name])
  );

  // Nama sasaran promo (produk/kategori) untuk ditampilkan saat edit.
  const scopeNames: Record<string, string> = { ...categoryNames };
  for (const promo of promotionsResult.data) {
    if (promo.scope !== "product" || !promo.scopeRefId) {
      continue;
    }
    const productResult = await container.catalog.getProduct.execute(
      promo.scopeRefId
    );
    if (!isErr(productResult) && productResult.data !== null) {
      scopeNames[promo.scopeRefId] = productResult.data.name;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/promo/voucher">Kelola voucher</Link>
        </Button>
      </div>
      <PromotionManagement
        promotions={promotionsResult.data.map((promo) => ({
          id: promo.id,
          name: promo.name,
          type: promo.type,
          scope: promo.scope,
          scopeRefId: promo.scopeRefId,
          value: promo.value.amount,
          buyQty: promo.buyQty,
          getQty: promo.getQty,
          minPurchase: promo.minPurchase.amount,
          startAt: promo.startAt.toISOString(),
          endAt: promo.endAt.toISOString(),
          isActive: promo.isActive,
        }))}
        categories={categories}
        scopeNames={scopeNames}
      />
    </div>
  );
}

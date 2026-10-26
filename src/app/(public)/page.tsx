import type { Metadata } from "next";
import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import { Storefront } from "@/modules/orders/presentation/components/storefront/storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const container = await getAppContainer();
  const result = await container.orders.getStorefrontSettings.execute();
  if (isErr(result)) {
    return { title: "Toko" };
  }
  return {
    title: result.data.storeName,
    description: `Belanja online dari ${result.data.storeName} — pesan langsung tanpa login.`,
  };
}

export default async function StorefrontPage() {
  const container = await getAppContainer();
  const result = await container.orders.getStorefrontData.execute();

  if (isErr(result)) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">
          Katalog sedang tidak tersedia. Coba lagi nanti.
        </p>
      </div>
    );
  }

  const { products, settings } = result.data;

  return (
    <Storefront
      products={products}
      settings={{
        storeName: settings.storeName,
        storeAddress: settings.storeAddress,
        storePhone: settings.storePhone,
        storeLogoUrl: settings.storeLogoUrl,
      }}
    />
  );
}

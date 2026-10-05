import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { SimpleMasterManagement } from "@/modules/catalog/presentation/components/simple-master-management";
import {
  createBrandAction,
  deleteBrandAction,
  updateBrandAction,
} from "@/modules/catalog/presentation/actions/master-data.action";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Brand — POS DNAE",
};

export default async function BrandsPage() {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const result = await container.catalog.listBrands.execute();
  if (isErr(result)) {
    throw new Error(result.error.message);
  }

  return (
    <SimpleMasterManagement
      title="Brand"
      description="Brand atau merek produk"
      itemLabel="Brand"
      idField="brandId"
      items={result.data.map((b) => ({ id: b.id, name: b.name }))}
      createAction={createBrandAction}
      updateAction={updateBrandAction}
      deleteAction={deleteBrandAction}
    />
  );
}

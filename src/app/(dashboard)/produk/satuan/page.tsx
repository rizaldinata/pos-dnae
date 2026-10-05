import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { SimpleMasterManagement } from "@/modules/catalog/presentation/components/simple-master-management";
import {
  createUnitAction,
  deleteUnitAction,
  updateUnitAction,
} from "@/modules/catalog/presentation/actions/master-data.action";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Satuan — POS DNAE",
};

export default async function UnitsPage() {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const result = await container.catalog.listUnits.execute();
  if (isErr(result)) {
    throw new Error(result.error.message);
  }

  return (
    <SimpleMasterManagement
      title="Satuan"
      description="Satuan produk (Pcs, Pack, Kg, ...)"
      itemLabel="Satuan"
      idField="unitId"
      items={result.data.map((u) => ({
        id: u.id,
        name: u.name,
        shortName: u.shortName,
      }))}
      createAction={createUnitAction}
      updateAction={updateUnitAction}
      deleteAction={deleteUnitAction}
      secondField={{ name: "shortName", label: "Singkatan" }}
    />
  );
}

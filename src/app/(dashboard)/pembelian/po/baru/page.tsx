import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { POForm } from "@/modules/purchasing/presentation/components/po-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Buat PO — POS DNAE",
};

export default async function NewPOPage() {
  const guard = await requirePermission("purchasing.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const suppliers = await container.purchasing.listSuppliers.execute();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Buat Purchase Order</h1>
        <p className="text-sm text-muted-foreground">
          Pilih supplier dan item barang
        </p>
      </div>
      <POForm
        suppliers={
          suppliers.success
            ? suppliers.data.map((s) => ({ id: s.id, name: s.name }))
            : []
        }
      />
    </div>
  );
}

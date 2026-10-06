import { redirect } from "next/navigation";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { SupplierManagement } from "@/modules/purchasing/presentation/components/supplier-management";
import { listSuppliersAction } from "@/modules/purchasing/presentation/actions/purchasing.action";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Supplier",
};

export default async function SuppliersPage() {
  const guard = await requirePermission("purchasing.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const suppliers = await listSuppliersAction();

  return <SupplierManagement suppliers={suppliers} />;
}

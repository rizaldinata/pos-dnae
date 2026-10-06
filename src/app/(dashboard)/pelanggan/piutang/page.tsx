import { redirect } from "next/navigation";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { ReceivableManagement } from "@/modules/customers/presentation/components/receivable-management";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Piutang",
};

export default async function ReceivablesPage() {
  const guard = await requirePermission("customer.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  return <ReceivableManagement />;
}

import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { OrderManagement } from "@/modules/orders/presentation/components/order-management";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pesanan",
};

export default async function PesananPage() {
  const guard = await requirePermission("order.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }
  return <OrderManagement />;
}

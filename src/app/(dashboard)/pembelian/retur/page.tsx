import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { PurchaseReturnManagement } from "@/modules/purchasing/presentation/components/purchase-return-management";
import { listSuppliersAction } from "@/modules/purchasing/presentation/actions/purchasing.action";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Retur Supplier — POS DNAE",
};

export default async function PurchaseReturnPage() {
  const guard = await requirePermission("purchasing.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const suppliers = await listSuppliersAction();
  const returnsResult =
    await container.purchasing.listPurchaseReturns.execute(undefined);
  if (isErr(returnsResult)) {
    throw new Error(returnsResult.error.message);
  }

  return (
    <PurchaseReturnManagement
      suppliers={suppliers}
      returns={
        isErr(returnsResult)
          ? []
          : returnsResult.data.map((r) => ({
              id: r.id,
              returnNo: r.returnNo,
              reason: r.reason,
              totalRefund: r.totalRefund.amount,
              createdAt: r.createdAt.toISOString(),
            }))
      }
    />
  );
}

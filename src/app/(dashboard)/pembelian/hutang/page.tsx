import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { Button } from "@/shared/ui/button";
import { SupplierDebtManagement } from "@/modules/purchasing/presentation/components/supplier-debt-management";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hutang Supplier",
};

export default async function SupplierDebtPage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string; status?: string }>;
}) {
  const guard = await requirePermission("purchasing.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const container = await getAppContainer();
  const debtsResult = await container.purchasing.listSupplierDebts.execute({
    supplierId: params.supplierId || undefined,
    status:
      (params.status as
        "unpaid" | "partial" | "paid" | "overdue" | undefined) || undefined,
    page: 1,
    pageSize: 100,
  });
  if (isErr(debtsResult)) {
    throw new Error(debtsResult.error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/pembelian/po">Purchase Order</Link>
        </Button>
      </div>
      <SupplierDebtManagement
        debts={debtsResult.data.items.map((d) => ({
          poId: d.id,
          poNo: d.poNo,
          supplierName: d.supplierName,
          total: d.total.amount,
          paid: d.paid.amount,
          remaining: d.remaining.amount,
          dueDate: d.dueDate,
          isPaid: d.isPaid,
          isOverdue: d.isOverdue,
        }))}
      />
    </div>
  );
}

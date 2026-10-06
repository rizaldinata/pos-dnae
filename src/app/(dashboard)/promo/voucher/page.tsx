import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { Button } from "@/shared/ui/button";
import { VoucherManagement } from "@/modules/promotions/presentation/components/voucher-management";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Voucher — POS DNAE",
};

export default async function VouchersPage() {
  const guard = await requirePermission("promo.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const result = await container.promotions.listVouchers.execute();
  if (isErr(result)) {
    throw new Error(result.error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/promo">Kelola promo</Link>
        </Button>
      </div>
      <VoucherManagement
        vouchers={result.data.map((voucher) => ({
          id: voucher.id,
          code: voucher.code,
          type: voucher.type,
          value: voucher.value.amount,
          quota: voucher.quota,
          usedCount: voucher.usedCount,
          remainingQuota: voucher.remainingQuota,
          minPurchase: voucher.minPurchase.amount,
          expiresAt: voucher.expiresAt ? voucher.expiresAt.toISOString() : null,
          isActive: voucher.isActive,
        }))}
      />
    </div>
  );
}

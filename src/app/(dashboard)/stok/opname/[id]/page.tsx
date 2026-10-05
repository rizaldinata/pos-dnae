import { notFound, redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { OpnameDetail } from "@/modules/inventory/presentation/components/opname-detail";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Opname — POS DNAE",
};

export default async function OpnameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requirePermission("stock.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const { id } = await params;
  const container = await getAppContainer();
  const result = await container.inventory.getOpnameDetail.execute(id);
  if (isErr(result)) {
    throw new Error(result.error.message);
  }
  if (result.data === null) {
    notFound();
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{result.data.opname.code}</h1>
        <p className="text-sm text-muted-foreground">
          Input stok fisik per varian, lalu setujui untuk menyesuaikan
        </p>
      </div>
      <OpnameDetail
        opnameId={result.data.opname.id}
        code={result.data.opname.code}
        status={result.data.opname.status}
        items={result.data.items.map((item) => ({
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          systemQty: item.systemQty,
          actualQty: item.actualQty,
          diff: item.diff,
        }))}
        canApprove={guard.user.hasPermission("opname.approve")}
      />
    </div>
  );
}

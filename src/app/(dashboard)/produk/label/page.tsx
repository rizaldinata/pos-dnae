import { redirect } from "next/navigation";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { LabelPrinter } from "@/modules/catalog/presentation/components/label-printer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cetak Label Barcode",
};

export default async function LabelPrintPage() {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Cetak Label Barcode</h1>
        <p className="text-sm text-muted-foreground">
          Pilih produk, atur layout label, lalu cetak via dialog browser.
          (PRD-07)
        </p>
      </div>
      <LabelPrinter />
    </div>
  );
}

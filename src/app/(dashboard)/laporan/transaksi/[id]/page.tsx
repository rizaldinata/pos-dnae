import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { Button } from "@/shared/ui/button";
import { ReceiptPreview } from "@/modules/sales/presentation/components/receipt-preview";
import { ReceiptPdfDownload } from "@/modules/sales/presentation/components/receipt-pdf";
import { PrintReceiptButton } from "@/modules/sales/presentation/components/print-receipt-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Transaksi — POS DNAE",
};

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requirePermission("report.view");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const { id } = await params;
  const container = await getAppContainer();
  const [receiptResult, settingsResult] = await Promise.all([
    container.sales.getSaleReceipt.execute({ id }),
    container.settings.getStoreSettings.execute(),
  ]);

  if (isErr(receiptResult)) {
    throw new Error(receiptResult.error.message);
  }
  if (receiptResult.data === null) {
    notFound();
  }
  if (isErr(settingsResult)) {
    throw new Error(settingsResult.error.message);
  }

  const { sale, items, payments } = receiptResult.data;
  const settings = settingsResult.data;
  const receipt = {
    saleId: sale.id,
    invoiceNo: sale.invoiceNo,
    createdAt: sale.createdAt.toISOString(),
    cashierName: guard.user.fullName,
    subtotal: sale.subtotal.amount,
    discountTotal: sale.discountTotal.amount,
    grandTotal: sale.grandTotal.amount,
    paidTotal: sale.paidTotal.amount,
    changeAmount: sale.changeAmount.amount,
    items: items.map((item) => ({
      productName: item.productName,
      sku: item.sku,
      qty: item.qty,
      unitPrice: item.unitPrice.amount,
      discount: item.discount.amount,
      subtotal: item.subtotal.amount,
    })),
    payments: payments.map((p) => ({
      paymentMethodName: p.paymentMethodName,
      paymentMethodType: p.paymentMethodType,
      amount: p.amount.amount,
      referenceNo: p.referenceNo,
    })),
  };
  const store = {
    name: settings.storeName,
    address: settings.storeAddress,
    phone: settings.storePhone,
    footer: settings.receiptFooter,
  };

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{sale.invoiceNo}</h1>
          <p className="text-sm text-muted-foreground">Detail transaksi</p>
        </div>
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/laporan/penjualan">Kembali</Link>
        </Button>
      </div>
      <ReceiptPreview receipt={receipt} store={store} />
      <div className="flex gap-2">
        <PrintReceiptButton />
        <ReceiptPdfDownload receipt={receipt} store={store} />
      </div>
    </div>
  );
}

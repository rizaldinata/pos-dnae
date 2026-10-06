import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import { Button } from "@/shared/ui/button";
import { ReceiptPreview } from "@/modules/sales/presentation/components/receipt-preview";
import { ReceiptPdfDownload } from "@/modules/sales/presentation/components/receipt-pdf";
import { PrintReceiptButton } from "@/modules/sales/presentation/components/print-receipt-button";
import { VoidSaleDialog } from "@/modules/sales/presentation/components/void-sale-dialog";
import { ReturnSaleDialog } from "@/modules/sales/presentation/components/return-sale-dialog";
import { Badge } from "@/shared/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Transaksi",
};

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Struk boleh dilihat semua peran yang login (read-only) agar kasir bisa
  // mengajukan void/retur; tombol aksi tetap digate permission sale.void/sale.return.
  const container = await getAppContainer();
  const currentResult = await container.iam.getCurrentUser.execute();
  if (isErr(currentResult) || currentResult.data === null) {
    redirect("/login");
  }
  const viewer = currentResult.data;

  const { id } = await params;
  const [receiptResult, settingsResult, methodsResult] = await Promise.all([
    container.sales.getSaleReceipt.execute({ id }),
    container.settings.getStoreSettings.execute(),
    container.settings.listActivePaymentMethods.execute(),
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
  if (isErr(methodsResult)) {
    throw new Error(methodsResult.error.message);
  }

  const { sale, items, payments } = receiptResult.data;
  const settings = settingsResult.data;
  const receipt = {
    saleId: sale.id,
    invoiceNo: sale.invoiceNo,
    status: sale.status,
    createdAt: sale.createdAt.toISOString(),
    cashierName: viewer.fullName,
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{sale.invoiceNo}</h1>
            <Badge
              variant={sale.status === "completed" ? "default" : "secondary"}
            >
              {sale.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Detail transaksi</p>
        </div>
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/laporan/penjualan">Kembali</Link>
        </Button>
      </div>
      {(sale.status === "completed" || sale.status === "partial_return") && (
        <div className="flex flex-wrap items-center gap-2">
          {viewer.hasPermission("sale.void") ? (
            <VoidSaleDialog saleId={sale.id} invoiceNo={sale.invoiceNo} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Void & retur memerlukan manajer
            </p>
          )}
          {viewer.hasPermission("sale.return") && (
            <ReturnSaleDialog
              saleId={sale.id}
              invoiceNo={sale.invoiceNo}
              items={items
                .filter((item) => item.returnableQty > 0)
                .map((item) => ({
                  saleItemId: item.id,
                  productName: item.productName,
                  sku: item.sku,
                  qty: item.qty,
                  returnedQty: item.returnedQty,
                  unitPrice: item.unitPrice.amount,
                }))}
              paymentMethods={methodsResult.data.map((m) => ({
                id: m.id,
                name: m.name,
                type: m.type,
                isCash: m.isCash,
              }))}
            />
          )}
        </div>
      )}
      <ReceiptPreview receipt={receipt} store={store} />
      <div className="flex gap-2">
        <PrintReceiptButton />
        <ReceiptPdfDownload receipt={receipt} store={store} />
      </div>
    </div>
  );
}

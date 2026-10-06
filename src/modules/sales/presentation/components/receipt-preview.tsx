import type { ReceiptDTO } from "@/modules/sales/presentation/actions/checkout.action";
import { formatRupiah } from "@/shared/lib/format-rupiah";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

export interface ReceiptStoreInfo {
  name: string;
  address: string;
  phone: string;
  footer: string;
}

export const DEFAULT_RECEIPT_STORE: ReceiptStoreInfo = {
  name: "Toko DNAE",
  address: "Jl. Contoh No. 1, Jakarta",
  phone: "0812-0000-0000",
  footer: "Terima kasih telah berbelanja.",
};

export function ReceiptPreview({
  receipt,
  store = DEFAULT_RECEIPT_STORE,
}: {
  receipt: ReceiptDTO;
  store?: ReceiptStoreInfo;
}) {
  return (
    <div className="receipt-print-area mx-auto w-full max-w-75 bg-white p-4 font-mono text-xs text-black">
      <div className="text-center">
        <p className="text-sm font-bold">{store.name}</p>
        {store.address && <p>{store.address}</p>}
        {store.phone && <p>{store.phone}</p>}
      </div>
      <hr className="my-2 border-dashed border-black" />
      <div className="flex justify-between">
        <span>{receipt.invoiceNo}</span>
      </div>
      <div className="flex justify-between">
        <span>{formatDateTime(receipt.createdAt)}</span>
        <span>{receipt.cashierName}</span>
      </div>
      <hr className="my-2 border-dashed border-black" />
      <ul className="flex flex-col gap-1">
        {receipt.items.map((item, index) => (
          <li key={`${item.sku}-${index}`}>
            <p className="font-bold">{item.productName}</p>
            <div className="flex justify-between">
              <span>
                {item.qty} x {formatRupiah(item.unitPrice)}
              </span>
              <span>{formatRupiah(item.subtotal)}</span>
            </div>
            {item.discount > 0 && (
              <div className="flex justify-between">
                <span>Diskon</span>
                <span>-{formatRupiah(item.discount)}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      <hr className="my-2 border-dashed border-black" />
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatRupiah(receipt.subtotal)}</span>
      </div>
      {receipt.discountTotal > 0 && (
        <div className="flex justify-between">
          <span>Diskon</span>
          <span>-{formatRupiah(receipt.discountTotal)}</span>
        </div>
      )}
      <div className="flex justify-between text-sm font-bold">
        <span>Total</span>
        <span>{formatRupiah(receipt.grandTotal)}</span>
      </div>
      {receipt.status === "credit" && (
        <div className="flex justify-between">
          <span>Piutang</span>
          <span>{formatRupiah(receipt.grandTotal - receipt.paidTotal)}</span>
        </div>
      )}
      {receipt.payments.map((p, index) => (
        <div key={index} className="flex justify-between">
          <span>
            {p.paymentMethodName}
            {p.referenceNo ? ` (${p.referenceNo})` : ""}
          </span>
          <span>{formatRupiah(p.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between">
        <span>Kembali</span>
        <span>{formatRupiah(receipt.changeAmount)}</span>
      </div>
      <hr className="my-2 border-dashed border-black" />
      <p className="text-center">{store.footer}</p>
    </div>
  );
}

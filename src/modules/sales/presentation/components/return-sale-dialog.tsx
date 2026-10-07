"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReturnAction } from "@/modules/sales/presentation/actions/void-return.action";
import type { PaymentMethodDTO } from "@/modules/sales/presentation/actions/checkout.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { formatRupiah } from "@/shared/lib/format-rupiah";

export interface ReturnableItem {
  saleItemId: string;
  productName: string;
  sku: string;
  qty: number;
  returnedQty: number;
  unitPrice: number;
}

export function ReturnSaleDialog({
  saleId,
  invoiceNo,
  items,
  paymentMethods,
}: {
  saleId: string;
  invoiceNo: string;
  items: ReturnableItem[];
  paymentMethods: PaymentMethodDTO[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [refundMethodId, setRefundMethodId] = useState(
    paymentMethods.find((m) => m.isCash)?.id ?? paymentMethods[0]?.id ?? ""
  );
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = items
    .map((item) => ({
      item,
      qty: Math.floor(Number(quantities[item.saleItemId]) || 0),
    }))
    .filter((entry) => entry.qty > 0);
  const estimatedRefund = selected.reduce(
    (sum, entry) => sum + Math.round(entry.item.unitPrice * entry.qty),
    0
  );

  function handleReturn() {
    startTransition(async () => {
      const result = await createReturnAction(
        saleId,
        selected.map((entry) => ({
          saleItemId: entry.item.saleItemId,
          qty: entry.qty,
        })),
        refundMethodId,
        reason
      );
      if (!result.success) {
        setMessage(result.message ?? "Retur gagal");
        return;
      }
      setOpen(false);
      setQuantities({});
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="min-h-11"
      >
        Retur item
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Retur {invoiceNo}</DialogTitle>
            <DialogDescription>
              Pilih item dan jumlah yang dikembalikan. Stok bertambah kembali
              dan tercatat di kartu stok.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const max = item.qty - item.returnedQty;
              return (
                <li
                  key={item.saleItemId}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.productName}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.sku} • beli {item.qty}
                      {item.returnedQty > 0
                        ? ` • sudah retur ${item.returnedQty}`
                        : ""}
                    </p>
                  </div>
                  <Input
                    aria-label={`Qty retur ${item.sku}`}
                    type="number"
                    min={0}
                    max={max}
                    value={quantities[item.saleItemId] ?? ""}
                    onChange={(e) =>
                      setQuantities((prev) => ({
                        ...prev,
                        [item.saleItemId]: e.target.value,
                      }))
                    }
                    disabled={pending || max <= 0}
                    placeholder="0"
                    className="h-11 w-20 text-center"
                  />
                </li>
              );
            })}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="return-method" className="text-sm font-medium">
                Metode refund
              </label>
              <select
                id="return-method"
                value={refundMethodId}
                onChange={(e) => setRefundMethodId(e.target.value)}
                disabled={pending}
                className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="return-reason" className="text-sm font-medium">
                Alasan (wajib)
              </label>
              <Input
                id="return-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                placeholder="cth. barang cacat"
                className="min-h-11"
              />
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimasi refund</span>
            <span className="font-semibold">
              {formatRupiah(estimatedRefund)}
            </span>
          </div>
          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button
              onClick={handleReturn}
              loading={pending}
              disabled={
                pending ||
                selected.length === 0 ||
                reason.trim() === "" ||
                !refundMethodId
              }
              className="min-h-11"
            >
              {pending ? "Memproses..." : "Proses retur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

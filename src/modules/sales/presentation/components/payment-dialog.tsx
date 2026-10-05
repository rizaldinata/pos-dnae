"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  checkoutAction,
  listActivePaymentMethodsAction,
  type PaymentMethodDTO,
  type ReceiptDTO,
} from "@/modules/sales/presentation/actions/checkout.action";
import { getStoreSettingsAction } from "@/modules/settings/presentation/actions/settings.action";
import type { StoreSettings } from "@/modules/settings/domain/entities/store-setting";
import {
  useCartStore,
  toCartItemEntities,
} from "@/modules/sales/presentation/hooks/use-cart-store";
import { PricingCalculator } from "@/modules/sales/domain/entities/cart";
import { Discount } from "@/modules/sales/domain/value-objects/discount";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { ReceiptPreview } from "@/modules/sales/presentation/components/receipt-preview";
import { ReceiptPdfDownload } from "@/modules/sales/presentation/components/receipt-pdf";

const QUICK_CASH = [10000, 20000, 50000, 100000];

export function PaymentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const items = useCartStore((s) => s.items);
  const transactionDiscount = useCartStore((s) => s.transactionDiscount);
  const clearCart = useCartStore((s) => s.clearCart);

  const entities = useMemo(() => toCartItemEntities(items), [items]);
  const trxDiscount = useMemo(() => {
    if (!transactionDiscount) {
      return null;
    }
    try {
      return transactionDiscount.kind === "percent"
        ? Discount.percent(Math.min(transactionDiscount.value, 100))
        : Discount.amount(transactionDiscount.value);
    } catch {
      return null;
    }
  }, [transactionDiscount]);
  const totals = useMemo(
    () => PricingCalculator.calculate(entities, trxDiscount),
    [entities, trxDiscount]
  );

  const [methods, setMethods] = useState<PaymentMethodDTO[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );
  const [methodId, setMethodId] = useState<string>("");
  const [received, setReceived] = useState<string>(() =>
    String(totals.grandTotal)
  );
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<ReceiptDTO | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  const selectedMethod = methods.find((m) => m.id === methodId) ?? null;
  const isCash = !selectedMethod || selectedMethod.isCash;

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    listActivePaymentMethodsAction().then((list) => {
      if (cancelled) {
        return;
      }
      setMethods(list);
      const cash = list.find((m) => m.isCash);
      setMethodId((prev) => prev || cash?.id || list[0]?.id || "");
    });
    getStoreSettingsAction()
      .then((settings) => {
        if (!cancelled) {
          setStoreSettings(settings);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const receivedAmount = Math.round(Number(received) || 0);
  const payAmount = isCash ? receivedAmount : totals.grandTotal;
  const change = payAmount - totals.grandTotal;
  const canConfirm =
    !pending &&
    items.length > 0 &&
    payAmount >= totals.grandTotal &&
    totals.grandTotal >= 0;

  function handleConfirm() {
    if (!canConfirm || !methodId) {
      return;
    }
    startTransition(async () => {
      const result = await checkoutAction({
        idempotencyKey: idempotencyKey.current,
        items: entities.map((item) => ({
          variantId: item.variantId,
          qty: item.qty,
          discount: item.discount
            ? { kind: item.discount.kind, value: item.discount.value }
            : undefined,
        })),
        payments: [
          {
            paymentMethodId: methodId,
            amount: payAmount,
            referenceNo: isCash ? null : reference || null,
          },
        ],
      });
      if (!result.success || !result.receipt) {
        setMessage(result.message ?? "Pembayaran gagal");
        return;
      }
      setReceipt(result.receipt);
      clearCart();
    });
  }

  function handleNewTransaction() {
    setReceipt(null);
    onClose();
    requestAnimationFrame(() => {
      document.getElementById("pos-search-input")?.focus();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && !receipt && onClose()}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {receipt ? "Transaksi berhasil" : "Pembayaran"}
          </DialogTitle>
        </DialogHeader>

        {!receipt ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-md bg-muted p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total tagihan</span>
                <span className="text-lg font-bold">
                  {formatRupiah(totals.grandTotal)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {totals.totalQty} item • {items.length} baris
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="pay-method" className="text-sm font-medium">
                Metode pembayaran
              </label>
              <select
                id="pay-method"
                value={methodId}
                onChange={(e) => {
                  setMethodId(e.target.value);
                  const method = methods.find((m) => m.id === e.target.value);
                  if (!method || method.isCash) {
                    setReceived(String(totals.grandTotal));
                  }
                }}
                disabled={pending}
                className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {isCash ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="pay-received" className="text-sm font-medium">
                  Uang diterima
                </label>
                <Input
                  id="pay-received"
                  type="number"
                  min={0}
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  disabled={pending}
                  className="min-h-11 text-lg"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setReceived(String(totals.grandTotal))}
                  >
                    Uang pas
                  </Button>
                  {QUICK_CASH.map((nominal) => (
                    <Button
                      key={nominal}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setReceived(String(nominal))}
                    >
                      {formatRupiah(nominal)}
                    </Button>
                  ))}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kembalian</span>
                  <span
                    className={`font-semibold ${change < 0 ? "text-destructive" : ""}`}
                  >
                    {change < 0
                      ? "Kurang " + formatRupiah(-change)
                      : formatRupiah(change)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nominal</span>
                  <span className="font-semibold">
                    {formatRupiah(totals.grandTotal)}
                  </span>
                </div>
                <label htmlFor="pay-reference" className="text-sm font-medium">
                  Nomor referensi{" "}
                  <span className="font-normal text-muted-foreground">
                    (opsional)
                  </span>
                </label>
                <Input
                  id="pay-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={pending}
                  placeholder="No. referensi EDC / QRIS / transfer"
                  className="min-h-11"
                />
              </div>
            )}

            {message && (
              <p role="alert" className="text-sm text-destructive">
                {message}
              </p>
            )}

            <Button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="min-h-12 text-base"
            >
              {pending
                ? "Memproses..."
                : `Konfirmasi ${formatRupiah(payAmount)}`}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-md bg-muted p-3 text-center">
              <p className="text-sm text-muted-foreground">Kembalian</p>
              <p className="text-2xl font-bold">
                {formatRupiah(receipt.changeAmount)}
              </p>
            </div>
            <ReceiptPreview
              receipt={receipt}
              store={
                storeSettings
                  ? {
                      name: storeSettings.storeName,
                      address: storeSettings.storeAddress,
                      phone: storeSettings.storePhone,
                      footer: storeSettings.receiptFooter,
                    }
                  : undefined
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="min-h-11 flex-1"
              >
                Cetak struk
              </Button>
              <ReceiptPdfDownload
                receipt={receipt}
                store={
                  storeSettings
                    ? {
                        name: storeSettings.storeName,
                        address: storeSettings.storeAddress,
                        phone: storeSettings.storePhone,
                        footer: storeSettings.receiptFooter,
                      }
                    : undefined
                }
              />
              <Button
                onClick={handleNewTransaction}
                className="min-h-11 flex-1"
              >
                Transaksi baru
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

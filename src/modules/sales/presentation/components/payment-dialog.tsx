"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  checkoutAction,
  listActivePaymentMethodsAction,
  type PaymentMethodDTO,
  type ReceiptDTO,
} from "@/modules/sales/presentation/actions/checkout.action";
import { getStoreSettingsAction } from "@/modules/settings/presentation/actions/settings.action";
import {
  getLoyaltyPreviewAction,
  type LoyaltyPreviewDTO,
} from "@/modules/customers/presentation/actions/loyalty.action";
import type { StoreSettings } from "@/modules/settings/domain/entities/store-setting";
import { useCartStore } from "@/modules/sales/presentation/hooks/use-cart-store";
import { useCartTotals } from "@/modules/sales/presentation/hooks/use-cart-totals";
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

interface PaymentRow {
  key: string;
  methodId: string;
  amount: string;
  reference: string;
}

function newRowKey(): string {
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const selectClass =
  "flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm";

export function PaymentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const selectedCustomer = useCartStore((s) => s.selectedCustomer);
  const items = useCartStore((s) => s.items);
  const transactionDiscount = useCartStore((s) => s.transactionDiscount);
  const voucher = useCartStore((s) => s.voucher);
  const redeem = useCartStore((s) => s.redeem);
  const clearCart = useCartStore((s) => s.clearCart);
  const { entities, pricingTotals, tax } = useCartTotals();

  const grandTotal = tax.grandTotal;

  const [methods, setMethods] = useState<PaymentMethodDTO[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [isCredit, setIsCredit] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltyPreviewDTO | null>(null);
  const [receipt, setReceipt] = useState<ReceiptDTO | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const idempotencyKey = useRef<string>(crypto.randomUUID());

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
      const firstId = cash?.id ?? list[0]?.id ?? "";
      setRows([
        {
          key: newRowKey(),
          methodId: firstId,
          amount: String(grandTotal),
          reference: "",
        },
      ]);
    });
    getStoreSettingsAction()
      .then((settings) => {
        if (!cancelled) {
          setStoreSettings(settings);
        }
      })
      .catch(() => {});
    if (selectedCustomer) {
      getLoyaltyPreviewAction(selectedCustomer.id, grandTotal)
        .then((preview) => {
          if (!cancelled) {
            setLoyalty(preview);
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function methodOf(row: PaymentRow): PaymentMethodDTO | null {
    return methods.find((m) => m.id === row.methodId) ?? null;
  }

  function updateRow(key: string, patch: Partial<PaymentRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  const paidTotal = rows.reduce(
    (sum, r) => sum + Math.max(Math.round(Number(r.amount) || 0), 0),
    0
  );
  const remaining = grandTotal - paidTotal;
  const change = Math.max(paidTotal - grandTotal, 0);
  const hasCashRow = rows.some((r) => methodOf(r)?.isCash ?? true);
  const creditBlocked = isCredit && !selectedCustomer;
  const canConfirm =
    !pending &&
    items.length > 0 &&
    !creditBlocked &&
    (isCredit
      ? true
      : rows.length > 0 &&
        rows.every((r) => r.methodId) &&
        paidTotal >= grandTotal &&
        grandTotal >= 0);

  function setFirstRowAmount(amount: number) {
    setRows((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const [first, ...rest] = prev as [PaymentRow, ...PaymentRow[]];
      return [{ ...first, amount: String(amount) }, ...rest];
    });
  }

  function addRow() {
    const cash = methods.find((m) => m.isCash);
    setRows((prev) => [
      ...prev,
      {
        key: newRowKey(),
        methodId: cash?.id ?? methods[0]?.id ?? "",
        amount: String(Math.max(remaining, 0)),
        reference: "",
      },
    ]);
  }

  function handleConfirm() {
    if (!canConfirm) {
      return;
    }
    startTransition(async () => {
      const result = await checkoutAction({
        idempotencyKey: idempotencyKey.current,
        isCredit,
        customerId: selectedCustomer?.id ?? null,
        items: entities.map((item) => ({
          variantId: item.variantId,
          qty: item.qty,
          discount: item.discount
            ? { kind: item.discount.kind, value: item.discount.value }
            : undefined,
        })),
        transactionDiscount: transactionDiscount ?? undefined,
        voucherCode: voucher?.code ?? null,
        redeemPoints: redeem?.points ?? 0,
        payments: rows.map((r) => ({
          paymentMethodId: r.methodId,
          amount: Math.round(Number(r.amount) || 0),
          referenceNo:
            (methodOf(r)?.isCash ?? true) ? null : r.reference || null,
        })),
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
                  {formatRupiah(grandTotal)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {pricingTotals.totalQty} item • {items.length} baris
                {tax.taxTotal > 0
                  ? ` • termasuk pajak ${formatRupiah(tax.taxTotal)}`
                  : ""}
                {tax.serviceTotal > 0
                  ? ` • layanan ${formatRupiah(tax.serviceTotal)}`
                  : ""}
              </p>
              {loyalty && (
                <p className="text-xs text-green-700">
                  {loyalty.earnRatio > 0
                    ? `Poin ${loyalty.currentPoints} → +${loyalty.earnedPoints} setelah transaksi`
                    : `Poin pelanggan: ${loyalty.currentPoints}`}
                </p>
              )}
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
              <input
                type="checkbox"
                checked={isCredit}
                onChange={(e) => {
                  const next = e.target.checked;
                  setIsCredit(next);
                  if (next) {
                    setRows([]);
                  } else if (rows.length === 0) {
                    const cash = methods.find((m) => m.isCash);
                    setRows([
                      {
                        key: newRowKey(),
                        methodId: cash?.id ?? methods[0]?.id ?? "",
                        amount: String(grandTotal),
                        reference: "",
                      },
                    ]);
                  }
                }}
                disabled={pending || !selectedCustomer}
                className="size-4"
              />
              Penjualan kredit (piutang)
              {!selectedCustomer && (
                <span className="text-xs text-muted-foreground">
                  — pilih pelanggan dulu
                </span>
              )}
            </label>

            <div className="flex flex-col gap-2">
              {rows.map((row, index) => {
                const method = methodOf(row);
                const isCash = method?.isCash ?? true;
                return (
                  <div key={row.key} className="rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        #{index + 1}
                      </span>
                      <select
                        aria-label={`Metode bayar ${index + 1}`}
                        value={row.methodId}
                        onChange={(e) =>
                          updateRow(row.key, { methodId: e.target.value })
                        }
                        disabled={pending}
                        className={`${selectClass} flex-1`}
                      >
                        {methods.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      {rows.length > 1 || isCredit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            setRows((prev) =>
                              prev.filter((r) => r.key !== row.key)
                            )
                          }
                        >
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input
                        aria-label={`Nominal bayar ${index + 1}`}
                        type="number"
                        min={0}
                        value={row.amount}
                        onChange={(e) =>
                          updateRow(row.key, { amount: e.target.value })
                        }
                        disabled={pending}
                        className="min-h-11 flex-1 text-lg"
                      />
                      {!isCash && (
                        <Input
                          aria-label={`Referensi ${index + 1}`}
                          value={row.reference}
                          onChange={(e) =>
                            updateRow(row.key, { reference: e.target.value })
                          }
                          disabled={pending}
                          placeholder="Referensi"
                          className="min-h-11 flex-1"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={addRow}
              >
                {isCredit ? "+ Tambah DP" : "+ Split payment"}
              </Button>
              {isCredit && rows.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Tanpa uang muka — seluruh tagihan menjadi piutang. Tambah
                  baris untuk DP sebagian.
                </p>
              )}
              {hasCashRow && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      setFirstRowAmount(
                        grandTotal -
                          (paidTotal -
                            Math.max(
                              Math.round(Number(rows[0]?.amount) || 0),
                              0
                            ))
                      )
                    }
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
                      onClick={() => setFirstRowAmount(nominal)}
                    >
                      {formatRupiah(nominal)}
                    </Button>
                  ))}
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {remaining > 0 ? "Sisa" : "Kembalian"}
                </span>
                <span
                  className={`font-semibold ${remaining > 0 ? "text-destructive" : ""}`}
                >
                  {remaining > 0
                    ? "Kurang " + formatRupiah(remaining)
                    : formatRupiah(change)}
                </span>
              </div>
            </div>

            {message && (
              <p role="alert" className="text-sm text-destructive">
                {message}
              </p>
            )}

            <Button
              onClick={handleConfirm}
              disabled={!canConfirm}
              loading={pending}
              className="min-h-12 text-base"
            >
              {pending
                ? "Memproses..."
                : `Konfirmasi ${formatRupiah(paidTotal)}`}
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

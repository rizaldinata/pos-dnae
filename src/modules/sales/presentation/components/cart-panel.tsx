"use client";

import { useState } from "react";
import {
  useCartStore,
  toCartItemEntities,
  type DiscountData,
} from "@/modules/sales/presentation/hooks/use-cart-store";
import { useCartTotals } from "@/modules/sales/presentation/hooks/use-cart-totals";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { toast } from "@/shared/ui/toast";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { PaymentDialog } from "@/modules/sales/presentation/components/payment-dialog";
import { VoucherField } from "@/modules/sales/presentation/components/voucher-field";
import { RedeemField } from "@/modules/sales/presentation/components/redeem-field";
import { Minus, Plus, Trash2 } from "lucide-react";

function DiscountInput({
  label,
  value,
  onApply,
  disabled,
}: {
  label: string;
  value: DiscountData | null;
  onApply: (discount: DiscountData | null) => string | null;
  disabled?: boolean;
}) {
  const [kind, setKind] = useState<"percent" | "amount">(
    value?.kind ?? "percent"
  );
  const [raw, setRaw] = useState(value ? String(value.value) : "");

  function apply() {
    if (raw === "") {
      const error = onApply(null);
      if (error) {
        toast({
          variant: "destructive",
          title: "Diskon ditolak",
          description: error,
        });
      }
      return;
    }
    const error = onApply({ kind, value: Number(raw) || 0 });
    if (error) {
      toast({
        variant: "destructive",
        title: "Diskon ditolak",
        description: error,
      });
    }
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        aria-label={`${label} tipe`}
        value={kind}
        onChange={(e) => setKind(e.target.value as "percent" | "amount")}
        disabled={disabled}
        className="h-9 rounded-md border border-input bg-transparent px-1 text-xs"
      >
        <option value="percent">%</option>
        <option value="amount">Rp</option>
      </select>
      <Input
        aria-label={`${label} nilai`}
        type="number"
        min={0}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) =>
          e.key === "Enter" && (e.target as HTMLInputElement).blur()
        }
        disabled={disabled}
        className="h-9 w-20 text-right text-xs"
        placeholder="0"
      />
    </div>
  );
}

export function CartPanel() {
  const items = useCartStore((s) => s.items);
  const transactionDiscount = useCartStore((s) => s.transactionDiscount);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const setItemDiscount = useCartStore((s) => s.setItemDiscount);
  const setTransactionDiscount = useCartStore((s) => s.setTransactionDiscount);
  const clearCart = useCartStore((s) => s.clearCart);
  const [confirmClear, setConfirmClear] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paySession, setPaySession] = useState(0);

  const {
    pricingTotals: totals,
    tax,
    promoExtraByLine,
    promoExtraTotal,
    giftPreviews,
    voucherDiscount,
    redeemDiscount,
    redeemPoints,
  } = useCartTotals();

  function changeQty(variantId: string, qty: number) {
    const error = setQty(variantId, qty);
    if (error) {
      toast({
        variant: "destructive",
        title: "Qty tidak valid",
        description: error,
      });
    }
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Keranjang ({totals.itemCount})</CardTitle>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirmClear) {
                clearCart();
                setConfirmClear(false);
              } else {
                setConfirmClear(true);
                setTimeout(() => setConfirmClear(false), 3000);
              }
            }}
          >
            {confirmClear ? "Yakin? Klik lagi" : "Bersihkan"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keranjang kosong. Cari atau scan produk untuk mulai.
          </p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {items.map((item) => {
              const entities = toCartItemEntities([item]);
              const net = entities[0]?.netAmount() ?? 0;
              return (
                <li key={item.variantId} className="rounded-md border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.variantName
                          ? `${item.productName} — ${item.variantName}`
                          : item.productName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.sku}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus ${item.sku}`}
                      onClick={() => removeItem(item.variantId)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Kurangi"
                        onClick={() => changeQty(item.variantId, item.qty - 1)}
                        disabled={item.qty <= 1}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <Input
                        aria-label="Jumlah"
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) =>
                          changeQty(item.variantId, Number(e.target.value))
                        }
                        className="h-9 w-16 text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Tambah"
                        onClick={() => changeQty(item.variantId, item.qty + 1)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {item.tierApplied && (
                          <span className="mr-1 line-through">
                            {formatRupiah(item.basePrice)}
                          </span>
                        )}
                        {formatRupiah(item.unitPrice)}
                        {item.tierApplied && (
                          <span className="ml-1 rounded bg-green-100 px-1 text-[10px] text-green-700">
                            Grosir
                          </span>
                        )}
                      </p>
                      <p className="text-sm font-semibold">
                        {formatRupiah(net)}
                      </p>
                      {(promoExtraByLine.get(item.variantId) ?? 0) > 0 && (
                        <p className="text-xs text-green-600">
                          Promo -
                          {formatRupiah(
                            promoExtraByLine.get(item.variantId) ?? 0
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-1">
                    <DiscountInput
                      label="Diskon"
                      value={item.itemDiscount}
                      onApply={(d) => setItemDiscount(item.variantId, d)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatRupiah(totals.subtotal)}</span>
          </div>
          {totals.itemDiscountTotal - promoExtraTotal > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Diskon item</span>
              <span>
                -{formatRupiah(totals.itemDiscountTotal - promoExtraTotal)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <DiscountInput
              label="Diskon transaksi"
              value={transactionDiscount}
              onApply={(d) => setTransactionDiscount(d)}
              disabled={items.length === 0}
            />
            {totals.transactionDiscountTotal > 0 && (
              <span className="text-green-600">
                -{formatRupiah(totals.transactionDiscountTotal)}
              </span>
            )}
          </div>
          {promoExtraTotal > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Diskon promo</span>
              <span>-{formatRupiah(promoExtraTotal)}</span>
            </div>
          )}
          {giftPreviews.length > 0 && (
            <ul className="flex flex-col gap-1 text-green-600">
              {giftPreviews.map((gift) => (
                <li key={gift.variantId} className="flex justify-between">
                  <span className="truncate">
                    Gratis: {gift.displayName} × {gift.qty}
                  </span>
                  <span>{formatRupiah(0)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Voucher</span>
            <VoucherField
              baseAmount={Math.max(
                totals.subtotal -
                  totals.itemDiscountTotal -
                  totals.transactionDiscountTotal,
                0
              )}
            />
          </div>
          {voucherDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Diskon voucher</span>
              <span>-{formatRupiah(voucherDiscount)}</span>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Tukar poin</span>
            <RedeemField />
          </div>
          {redeemDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Tukar {redeemPoints} poin</span>
              <span>-{formatRupiah(redeemDiscount)}</span>
            </div>
          )}
          {tax.taxTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pajak</span>
              <span>{formatRupiah(tax.taxTotal)}</span>
            </div>
          )}
          {tax.serviceTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Layanan</span>
              <span>{formatRupiah(tax.serviceTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatRupiah(tax.grandTotal)}</span>
          </div>
          <Button
            className="mt-1 min-h-12 text-base"
            disabled={items.length === 0}
            onClick={() => {
              setPaySession((n) => n + 1);
              setPayOpen(true);
            }}
          >
            Bayar
          </Button>
          {payOpen && (
            <PaymentDialog
              key={paySession}
              open={payOpen}
              onClose={() => setPayOpen(false)}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

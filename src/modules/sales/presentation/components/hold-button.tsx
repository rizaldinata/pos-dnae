"use client";

import { useEffect, useState, useTransition } from "react";
import {
  cancelHeldSaleAction,
  holdCurrentCartAction,
  listHeldSalesAction,
  resumeHeldSaleAction,
  type HeldSaleDTO,
} from "@/modules/sales/presentation/actions/hold.action";
import { useCartStore } from "@/modules/sales/presentation/hooks/use-cart-store";
import { useCartTotals } from "@/modules/sales/presentation/hooks/use-cart-totals";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { toast } from "@/shared/ui/toast";
import { formatRupiah } from "@/shared/lib/format-rupiah";

export function HoldButton() {
  const items = useCartStore((s) => s.items);
  const selectedCustomer = useCartStore((s) => s.selectedCustomer);
  const clearCart = useCartStore((s) => s.clearCart);
  const { entities, pricingTotals, tax } = useCartTotals();
  const [pending, startTransition] = useTransition();

  function handleHold() {
    startTransition(async () => {
      const result = await holdCurrentCartAction({
        items: entities.map((item) => ({
          variantId: item.variantId,
          qty: item.qty,
          discount: item.discountAmount(),
        })),
        customerId: selectedCustomer?.id ?? null,
        discountTotal: pricingTotals.itemDiscountTotal,
        transactionDiscount: pricingTotals.transactionDiscountTotal,
        taxTotal: tax.taxTotal,
        serviceFee: tax.serviceTotal,
      });
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Hold gagal",
          description: result.message ?? "",
        });
        return;
      }
      toast({ title: "Dihold", description: result.message ?? "" });
      clearCart();
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending || items.length === 0}
      onClick={handleHold}
      className="min-h-11"
    >
      {pending ? "Menyimpan..." : "Hold"}
    </Button>
  );
}

export function HeldSalesDialog({ refreshKey }: { refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState<HeldSaleDTO[]>([]);
  const [pending, startTransition] = useTransition();
  const addItem = useCartStore((s) => s.addItem);
  const setQty = useCartStore((s) => s.setQty);
  const setItemDiscount = useCartStore((s) => s.setItemDiscount);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    listHeldSalesAction().then((list) => {
      if (!cancelled) {
        setHeld(list);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, refreshKey]);

  function handleResume(saleId: string) {
    startTransition(async () => {
      const result = await resumeHeldSaleAction(saleId);
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Resume gagal",
          description: result.message,
        });
        return;
      }
      const resume = result.resume;
      for (const item of resume.items) {
        const error = addItem({
          variantId: item.variantId,
          productId: "",
          productName: item.productName,
          variantName: item.variantName,
          displayName: item.variantName
            ? `${item.productName} — ${item.variantName}`
            : item.productName,
          sku: item.sku,
          barcode: item.barcode,
          sellPrice: item.sellPrice,
          costPrice: item.costPrice,
          stockQty: item.stockQty,
          trackStock: item.trackStock,
          minStock: 0,
          tiers: item.tiers,
        });
        if (!error) {
          setQty(item.variantId, item.qty);
          if (item.discount > 0) {
            setItemDiscount(item.variantId, {
              kind: "amount",
              value: item.discount,
            });
          }
        }
      }
      setHeld((prev) => prev.filter((h) => h.saleId !== saleId));
      setOpen(false);
      toast({
        title: "Hold dibuka",
        description: `${resume.holdNo} dimuat ke keranjang`,
      });
    });
  }

  function handleCancel(saleId: string) {
    startTransition(async () => {
      const result = await cancelHeldSaleAction(saleId);
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: result.message ?? "",
        });
        return;
      }
      setHeld((prev) => prev.filter((h) => h.saleId !== saleId));
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative min-h-11"
      >
        Hold list
        {held.length > 0 && (
          <Badge variant="destructive" className="ml-1 text-[10px]">
            {held.length}
          </Badge>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaksi di-hold</DialogTitle>
          </DialogHeader>
          {held.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tidak ada transaksi di-hold.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {held.map((h) => (
                <li
                  key={h.saleId}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">{h.holdNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.itemCount} baris • {h.totalQty} item •{" "}
                      {formatRupiah(h.grandTotal)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => handleResume(h.saleId)}
                  >
                    Buka
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => handleCancel(h.saleId)}
                  >
                    Hapus
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

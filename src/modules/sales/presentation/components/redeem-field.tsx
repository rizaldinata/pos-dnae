"use client";

import { useState, useTransition } from "react";
import { previewRedeemAction } from "@/modules/customers/presentation/actions/loyalty.action";
import { useCartStore } from "@/modules/sales/presentation/hooks/use-cart-store";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { toast } from "@/shared/ui/toast";
import { formatRupiah } from "@/shared/lib/format-rupiah";

/**
 * Tukar poin sebagai potongan di keranjang (POS-14).
 * Kasir memilih pelanggan → input jumlah poin → server menghitung potongan
 * dari `loyalty.point_value`; pemotongan saldo terjadi atomik saat checkout.
 */
export function RedeemField() {
  const selectedCustomer = useCartStore((s) => s.selectedCustomer);
  const redeem = useCartStore((s) => s.redeem);
  const setRedeem = useCartStore((s) => s.setRedeem);
  const clearRedeem = useCartStore((s) => s.clearRedeem);
  const [points, setPoints] = useState("");
  const [pending, startTransition] = useTransition();

  if (!selectedCustomer) {
    return (
      <p className="text-xs text-muted-foreground">
        Tukar poin — pilih pelanggan dulu
      </p>
    );
  }
  const customerId = selectedCustomer.id;

  if (redeem) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-green-200 bg-green-50 px-2 py-1.5">
        <div className="min-w-0 text-sm">
          <span className="font-medium">{redeem.points} poin</span>
          <span className="ml-2 text-green-700">
            -{formatRupiah(redeem.discount)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearRedeem();
            setPoints("");
          }}
          disabled={pending}
        >
          Hapus
        </Button>
      </div>
    );
  }

  function apply() {
    const value = Math.floor(Number(points) || 0);
    if (value <= 0) {
      return;
    }
    startTransition(async () => {
      const result = await previewRedeemAction(customerId, value);
      if (!result.success || !result.redeem) {
        toast({
          variant: "destructive",
          title: "Poin ditolak",
          description: result.message ?? "Penukaran poin tidak valid",
        });
        return;
      }
      setRedeem({
        points: result.redeem.points,
        discount: result.redeem.discount,
      });
      setPoints("");
      toast({
        title: "Poin ditukar",
        description: `${result.redeem.points} poin → potongan ${formatRupiah(result.redeem.discount)}`,
      });
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Jumlah poin"
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          placeholder="Jumlah poin"
          disabled={pending}
          className="h-9 flex-1 text-sm"
          autoComplete="off"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={apply}
          disabled={
            pending || !points.trim() || Math.floor(Number(points) || 0) <= 0
          }
        >
          {pending ? "Cek..." : "Tukar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Saldo {selectedCustomer.name}: {selectedCustomer.points} poin
      </p>
    </div>
  );
}

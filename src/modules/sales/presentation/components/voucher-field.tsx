"use client";

import { useState, useTransition } from "react";
import { validateVoucherAction } from "@/modules/promotions/presentation/actions/promotion.action";
import { useCartStore } from "@/modules/sales/presentation/hooks/use-cart-store";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { toast } from "@/shared/ui/toast";
import { formatRupiah } from "@/shared/lib/format-rupiah";

/**
 * Input kode voucher di keranjang (POS-13).
 * Validasi & perhitungan dilakukan server; hasilnya disimpan ke cart store
 * dan dikirim ulang saat checkout untuk divalidasi lagi oleh RPC.
 */
export function VoucherField({ baseAmount }: { baseAmount: number }) {
  const voucher = useCartStore((s) => s.voucher);
  const setVoucher = useCartStore((s) => s.setVoucher);
  const clearVoucher = useCartStore((s) => s.clearVoucher);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  function apply() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      return;
    }
    startTransition(async () => {
      const result = await validateVoucherAction(trimmed, baseAmount);
      if (!result.success || !result.voucher) {
        toast({
          variant: "destructive",
          title: "Voucher ditolak",
          description: result.message ?? "Voucher tidak valid",
        });
        return;
      }
      setVoucher(result.voucher);
      setCode("");
      toast({
        title: "Voucher diterapkan",
        description: `${result.voucher.code} — potongan ${formatRupiah(result.voucher.discount)}`,
      });
    });
  }

  if (voucher) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-green-200 bg-green-50 px-2 py-1.5">
        <div className="min-w-0 text-sm">
          <span className="font-mono font-medium">{voucher.code}</span>
          <span className="ml-2 text-green-700">
            -{formatRupiah(voucher.discount)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearVoucher();
            setCode("");
          }}
          disabled={pending}
        >
          Hapus
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label="Kode voucher"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        }}
        placeholder="Kode voucher"
        disabled={pending}
        className="h-9 flex-1 text-sm uppercase"
        autoComplete="off"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={apply}
        loading={pending}
        disabled={pending || !code.trim()}
      >
        {pending ? "Cek..." : "Pakai"}
      </Button>
    </div>
  );
}

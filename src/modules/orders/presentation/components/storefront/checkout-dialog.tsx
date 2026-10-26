"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import type { CartLine } from "./storefront";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartLine[];
  total: number;
  onOrdered: (orderNo: string, phone: string) => void;
}

/**
 * Form pemesanan: data diri, cara penerimaan (ambil di toko / kirim),
 * dan metode pembayaran (QRIS / bayar di tempat). Tanpa login.
 */
export function CheckoutDialog({
  open,
  onOpenChange,
  cart,
  total,
  onOrdered,
}: CheckoutDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(
    "pickup"
  );
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [paymentType, setPaymentType] = useState<"cod" | "qris">("cod");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/storefront/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          fulfillment,
          address: fulfillment === "delivery" ? address : "",
          note,
          paymentType,
          items: cart.map((line) => ({
            variantId: line.variantId,
            qty: line.qty,
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        orderNo?: string;
      };
      if (!response.ok || !payload.orderNo) {
        setError(payload.message ?? "Gagal membuat pesanan. Coba lagi.");
        return;
      }
      onOrdered(payload.orderNo, phone);
    } catch {
      setError("Jaringan bermasalah. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Data pemesanan</DialogTitle>
          <DialogDescription>
            {cart.length} item · Total {formatRupiah(total)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="order-name" className="text-sm font-medium">
              Nama
            </label>
            <Input
              id="order-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder="Nama Anda"
              className="min-h-11"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="order-phone" className="text-sm font-medium">
              No. HP (WhatsApp)
            </label>
            <Input
              id="order-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="08xxxxxxxxxx"
              className="min-h-11"
            />
            <p className="text-xs text-muted-foreground">
              Dipakai untuk mengecek status pesanan Anda.
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Cara penerimaan</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFulfillment("pickup")}
                className={`rounded-md border p-3 text-left text-sm transition-colors ${
                  fulfillment === "pickup"
                    ? "border-primary bg-primary/5"
                    : "text-muted-foreground"
                }`}
              >
                <span className="block font-medium">Ambil di toko</span>
                <span className="text-xs">
                  Siap diambil setelah dikonfirmasi
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFulfillment("delivery")}
                className={`rounded-md border p-3 text-left text-sm transition-colors ${
                  fulfillment === "delivery"
                    ? "border-primary bg-primary/5"
                    : "text-muted-foreground"
                }`}
              >
                <span className="block font-medium">Kirim ke alamat</span>
                <span className="text-xs">Isi alamat pengiriman</span>
              </button>
            </div>
          </fieldset>

          {fulfillment === "delivery" ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="order-address" className="text-sm font-medium">
                Alamat pengiriman
              </label>
              <textarea
                id="order-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                maxLength={300}
                rows={3}
                placeholder="Nama jalan, nomor rumah, kelurahan, patokan"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <label htmlFor="order-note" className="text-sm font-medium">
              Catatan <span className="text-muted-foreground">(opsional)</span>
            </label>
            <Input
              id="order-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Mis. titip di pos satpam"
              className="min-h-11"
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Pembayaran</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType("cod")}
                className={`rounded-md border p-3 text-left text-sm transition-colors ${
                  paymentType === "cod"
                    ? "border-primary bg-primary/5"
                    : "text-muted-foreground"
                }`}
              >
                <span className="block font-medium">Bayar di tempat</span>
                <span className="text-xs">Tunai saat terima pesanan</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("qris")}
                className={`rounded-md border p-3 text-left text-sm transition-colors ${
                  paymentType === "qris"
                    ? "border-primary bg-primary/5"
                    : "text-muted-foreground"
                }`}
              >
                <span className="block font-medium">QRIS</span>
                <span className="text-xs">Scan &amp; unggah bukti bayar</span>
              </button>
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="min-h-12"
            loading={pending}
            disabled={pending || cart.length === 0}
          >
            {pending
              ? "Membuat pesanan..."
              : `Buat pesanan · ${formatRupiah(total)}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

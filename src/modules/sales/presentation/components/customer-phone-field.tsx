"use client";

import { useCartStore } from "@/modules/sales/presentation/hooks/use-cart-store";
import { Input } from "@/shared/ui/input";

/**
 * Input no. HP (WhatsApp) pelanggan — diinput opsional saat pesanan dibuat.
 * Nomor ikut tersimpan pada transaksi dan dipakai untuk mengirim notifikasi
 * struk setelah pembayaran berhasil (tombol "Kirim WA" di dialog sukses).
 */
export function CustomerPhoneField() {
  const customerPhone = useCartStore((s) => s.customerPhone);
  const setCustomerPhone = useCartStore((s) => s.setCustomerPhone);

  return (
    <Input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      maxLength={25}
      value={customerPhone}
      onChange={(e) => setCustomerPhone(e.target.value)}
      placeholder="No. HP WhatsApp (opsional)..."
      aria-label="No. HP pelanggan untuk notifikasi struk"
      className="min-h-11"
    />
  );
}

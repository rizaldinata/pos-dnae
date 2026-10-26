"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/** Form cek status pesanan: nomor pesanan + no. HP pemesan. */
export function CekPesananForm({
  initialOrderNo,
}: {
  initialOrderNo?: string;
}) {
  const router = useRouter();
  const [orderNo, setOrderNo] = useState(initialOrderNo ?? "");
  const [phone, setPhone] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const no = orderNo.trim().toUpperCase();
    if (!no || !phone.trim()) {
      return;
    }
    router.push(
      `/cek-pesanan/${encodeURIComponent(no)}?phone=${encodeURIComponent(phone.trim())}`
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="cek-order-no" className="text-sm font-medium">
          Nomor pesanan
        </label>
        <Input
          id="cek-order-no"
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          required
          placeholder="ORD-20261015-0001"
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="cek-phone" className="text-sm font-medium">
          No. HP pemesan
        </label>
        <Input
          id="cek-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          placeholder="08xxxxxxxxxx"
          className="min-h-11"
        />
      </div>
      <Button type="submit" className="min-h-11">
        Cek status pesanan
      </Button>
    </form>
  );
}

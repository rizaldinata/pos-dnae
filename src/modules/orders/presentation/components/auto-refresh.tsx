"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Memperbarui data server component secara berkala tanpa interaksi pengguna
 * (dipakai halaman status pesanan & daftar pesanan staf).
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}

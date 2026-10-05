"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/shared/ui/input";

export function ProductSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [prevQuery, setPrevQuery] = useState(initialQuery);
  const [, startTransition] = useTransition();

  // Sinkronkan input bila query URL berubah dari luar (mis. ganti filter).
  if (initialQuery !== prevQuery) {
    setPrevQuery(initialQuery);
    setValue(initialQuery);
  }

  useEffect(() => {
    if (value === initialQuery) {
      return;
    }
    const timer = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
          params.set("q", value);
        } else {
          params.delete("q");
        }
        params.delete("page");
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Cari nama, SKU, atau barcode..."
      className="min-h-11 max-w-sm"
      aria-label="Cari produk"
    />
  );
}

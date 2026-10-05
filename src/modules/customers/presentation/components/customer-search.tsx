"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/shared/ui/input";

export function CustomerSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [prevQuery, setPrevQuery] = useState(initialQuery);
  const [, startTransition] = useTransition();
  const timer = useRef<number | null>(null);

  if (initialQuery !== prevQuery) {
    setPrevQuery(initialQuery);
    setValue(initialQuery);
  }

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  function handleChange(next: string) {
    setValue(next);
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (next) {
          params.set("q", next);
        } else {
          params.delete("q");
        }
        params.delete("page");
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 300);
  }

  return (
    <Input
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Cari nama, telepon, atau email..."
      className="min-h-11 max-w-sm"
      aria-label="Cari pelanggan"
    />
  );
}

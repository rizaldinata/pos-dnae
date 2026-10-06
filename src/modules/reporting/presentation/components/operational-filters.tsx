"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/shared/ui/input";

export function OperationalFilters({
  dateFrom,
  dateTo,
  categories,
  currentCategoryId,
  showCategory,
}: {
  dateFrom: string;
  dateTo: string;
  categories: { id: string; name: string }[];
  currentCategoryId: string;
  showCategory?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function navigate(key: string, value: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const inputClass =
    "h-11 rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        aria-label="Tanggal mulai"
        className={inputClass}
        value={dateFrom}
        onChange={(e) => navigate("from", e.target.value)}
      />
      <span className="text-sm text-muted-foreground">s/d</span>
      <Input
        type="date"
        aria-label="Tanggal selesai"
        className={inputClass}
        value={dateTo}
        onChange={(e) => navigate("to", e.target.value)}
      />
      {showCategory && (
        <select
          aria-label="Filter kategori"
          className="flex h-11 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={currentCategoryId}
          onChange={(e) => navigate("categoryId", e.target.value)}
        >
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

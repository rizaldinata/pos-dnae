"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function StockFilters({
  categories,
  currentCategoryId,
  currentStatus,
}: {
  categories: { id: string; name: string }[];
  currentCategoryId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const selectClass =
    "flex h-11 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label="Filter kategori"
        className={selectClass}
        value={currentCategoryId}
        onChange={(e) => updateParam("categoryId", e.target.value)}
      >
        <option value="">Semua kategori</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter status stok"
        className={selectClass}
        value={currentStatus}
        onChange={(e) => updateParam("status", e.target.value)}
      >
        <option value="">Semua status</option>
        <option value="normal">Normal</option>
        <option value="menipis">Menipis</option>
        <option value="habis">Habis</option>
      </select>
    </div>
  );
}

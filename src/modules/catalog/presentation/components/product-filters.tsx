"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface FilterOption {
  id: string;
  name: string;
}

function useUpdateParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (key: string, value: string) => {
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
  };
}

export function ProductFilters({
  categories,
  brands,
  currentCategoryId,
  currentBrandId,
  currentStatus,
}: {
  categories: FilterOption[];
  brands: FilterOption[];
  currentCategoryId: string;
  currentBrandId: string;
  currentStatus: string;
}) {
  const updateParam = useUpdateParam();

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
        aria-label="Filter brand"
        className={selectClass}
        value={currentBrandId}
        onChange={(e) => updateParam("brandId", e.target.value)}
      >
        <option value="">Semua brand</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter status"
        className={selectClass}
        value={currentStatus}
        onChange={(e) => updateParam("status", e.target.value)}
      >
        <option value="">Semua status</option>
        <option value="aktif">Aktif</option>
        <option value="nonaktif">Nonaktif</option>
      </select>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  STOCK_MOVEMENT_TYPES,
  movementTypeLabel,
  type StockMovementType,
} from "@/modules/inventory/domain/entities/stock";

export function StockMovementTypeFilter({
  currentType,
}: {
  currentType: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParam(value: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("type", value);
      } else {
        params.delete("type");
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <select
      aria-label="Filter tipe pergerakan"
      className="flex h-11 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      value={currentType}
      onChange={(e) => updateParam(e.target.value)}
    >
      <option value="">Semua tipe</option>
      {(STOCK_MOVEMENT_TYPES as readonly string[]).map((t) => (
        <option key={t} value={t}>
          {movementTypeLabel(t as StockMovementType)}
        </option>
      ))}
    </select>
  );
}

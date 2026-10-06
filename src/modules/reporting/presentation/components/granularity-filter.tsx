"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ProfitGranularity } from "@/modules/reporting/domain/entities/advanced-report";

const OPTIONS: { value: ProfitGranularity; label: string }[] = [
  { value: "day", label: "Harian" },
  { value: "week", label: "Mingguan" },
  { value: "month", label: "Bulanan" },
];

/**
 * Mengganti granularitas sekaligus me-reset rentang tanggal,
 * karena default `from`/`to` mengikuti granularitas terpilih.
 */
export function GranularityFilter({ value }: { value: ProfitGranularity }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function navigate(grain: string) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("grain", grain);
      params.delete("from");
      params.delete("to");
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <select
      aria-label="Granularitas periode"
      className="flex h-11 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
      value={value}
      onChange={(e) => navigate(e.target.value)}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

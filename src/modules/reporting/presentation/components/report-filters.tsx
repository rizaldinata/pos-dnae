"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export type ReportMode = "harian" | "rentang" | "bulanan";

export function ReportFilters({
  mode,
  date,
  dateFrom,
  dateTo,
  year,
  month,
}: {
  mode: ReportMode;
  date: string;
  dateFrom: string;
  dateTo: string;
  year: number;
  month: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function navigate(next: Record<string, string>) {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const inputClass =
    "h-11 rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {(["harian", "rentang", "bulanan"] as ReportMode[]).map((m) => (
          <Button
            key={m}
            variant={mode === m ? "default" : "outline"}
            size="sm"
            className="min-h-11 capitalize"
            onClick={() => navigate({ mode: m })}
          >
            {m}
          </Button>
        ))}
      </div>
      {mode === "harian" && (
        <Input
          type="date"
          aria-label="Tanggal"
          className={`${inputClass} max-w-55`}
          value={date}
          onChange={(e) => navigate({ date: e.target.value })}
        />
      )}
      {mode === "rentang" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="Tanggal mulai"
            className={inputClass}
            value={dateFrom}
            onChange={(e) => navigate({ from: e.target.value })}
          />
          <span className="text-sm text-muted-foreground">s/d</span>
          <Input
            type="date"
            aria-label="Tanggal selesai"
            className={inputClass}
            value={dateTo}
            onChange={(e) => navigate({ to: e.target.value })}
          />
        </div>
      )}
      {mode === "bulanan" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            aria-label="Bulan"
            className={`${inputClass} w-24`}
            min={1}
            max={12}
            value={month}
            onChange={(e) => navigate({ month: e.target.value })}
          />
          <Input
            type="number"
            aria-label="Tahun"
            className={`${inputClass} w-28`}
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => navigate({ year: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

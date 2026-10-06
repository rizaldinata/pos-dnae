"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/shared/ui/input";

export function AuditLogFilters({
  actions,
  currentAction,
  currentFrom,
  currentTo,
}: {
  actions: string[];
  currentAction: string;
  currentFrom: string;
  currentTo: string;
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
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const inputClass =
    "h-11 rounded-md border border-input bg-transparent px-3 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Filter aksi"
        className="flex h-11 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        value={currentAction}
        onChange={(e) => navigate("action", e.target.value)}
      >
        <option value="">Semua aksi</option>
        {actions.map((action) => (
          <option key={action} value={action}>
            {action}
          </option>
        ))}
      </select>
      <Input
        type="date"
        aria-label="Tanggal mulai"
        className={inputClass}
        value={currentFrom}
        onChange={(e) => navigate("from", e.target.value)}
      />
      <Input
        type="date"
        aria-label="Tanggal selesai"
        className={inputClass}
        value={currentTo}
        onChange={(e) => navigate("to", e.target.value)}
      />
    </div>
  );
}

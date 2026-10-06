"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";

const TABS = [
  {
    href: "/keuangan/pengeluaran",
    label: "Pengeluaran",
    permission: "finance.manage",
  },
  { href: "/keuangan/arus-kas", label: "Arus kas", permission: "report.view" },
  {
    href: "/keuangan/laba-rugi",
    label: "Laba rugi",
    permission: "report.profit.view",
  },
];

export function FinanceNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => permissions.includes(tab.permission));
  if (tabs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex gap-1 border-b" aria-label="Navigasi keuangan">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "min-h-11 px-4 py-2 text-sm font-medium",
              active
                ? "border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

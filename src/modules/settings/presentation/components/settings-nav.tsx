"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";

const TABS = [
  { href: "/pengaturan/toko", label: "Toko" },
  { href: "/pengaturan/pembayaran", label: "Pembayaran" },
  { href: "/pengaturan/users", label: "Pengguna" },
];

export function SettingsNav({ showUsers }: { showUsers: boolean }) {
  const pathname = usePathname();
  const tabs = showUsers
    ? TABS
    : TABS.filter((t) => t.href !== "/pengaturan/users");

  return (
    <nav className="flex gap-1 border-b" aria-label="Navigasi pengaturan">
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

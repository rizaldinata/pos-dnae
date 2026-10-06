"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";

const TABS = [
  { href: "/pengaturan/toko", label: "Toko" },
  { href: "/pengaturan/pembayaran", label: "Pembayaran" },
  { href: "/pengaturan/loyalitas", label: "Loyalitas" },
  { href: "/pengaturan/inventori", label: "Inventori" },
  { href: "/pengaturan/users", label: "Pengguna" },
];

export function SettingsNav({
  showUsers,
  showAudit,
  showRoles,
}: {
  showUsers: boolean;
  showAudit?: boolean;
  showRoles?: boolean;
}) {
  const pathname = usePathname();
  let tabs = showUsers
    ? TABS
    : TABS.filter((t) => t.href !== "/pengaturan/users");
  if (showAudit) {
    tabs = [...tabs, { href: "/pengaturan/audit-log", label: "Audit Log" }];
  }
  if (showRoles) {
    tabs = [...tabs, { href: "/pengaturan/roles", label: "Role" }];
  }

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

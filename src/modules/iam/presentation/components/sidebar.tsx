"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Store,
  Package,
  Boxes,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/modules/iam/presentation/actions/auth.action";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";

export interface SidebarUser {
  fullName: string;
  roleName: string;
  permissions: string[];
}

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions: string[];
  available: boolean;
  activePrefixes?: string[];
}

const MENU_ITEMS: MenuItem[] = [
  {
    href: "/kasir",
    label: "Kasir",
    icon: Store,
    requiredPermissions: [],
    available: true,
  },
  {
    href: "/produk",
    label: "Produk",
    icon: Package,
    requiredPermissions: ["product.manage"],
    available: true,
  },
  {
    href: "/stok",
    label: "Stok",
    icon: Boxes,
    requiredPermissions: ["product.manage", "stock.manage"],
    available: true,
  },
  {
    href: "/pelanggan",
    label: "Pelanggan",
    icon: Users,
    requiredPermissions: ["customer.manage"],
    available: false,
  },
  {
    href: "/laporan/penjualan",
    label: "Laporan",
    icon: BarChart3,
    requiredPermissions: ["report.view"],
    available: true,
    activePrefixes: ["/laporan"],
  },
  {
    href: "/pengaturan/toko",
    label: "Pengaturan",
    icon: Settings,
    requiredPermissions: ["user.manage", "settings.manage"],
    available: true,
    activePrefixes: ["/pengaturan"],
  },
];

function canSee(item: MenuItem, permissions: string[]): boolean {
  if (item.requiredPermissions.length === 0) {
    return true;
  }
  return item.requiredPermissions.some((p) => permissions.includes(p));
}

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const visibleItems = MENU_ITEMS.filter((item) =>
    canSee(item, user.permissions)
  );

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-base font-semibold">POS DNAE</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium",
                pathname === "/"
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/60"
              )}
            >
              <Store className="size-4" />
              Dasbor
            </Link>
          </li>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              (item.activePrefixes ?? []).some(
                (prefix) =>
                  pathname === prefix || pathname.startsWith(`${prefix}/`)
              );
            const content = (
              <>
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {!item.available && (
                  <Badge variant="secondary" className="text-[10px]">
                    Segera
                  </Badge>
                )}
              </>
            );
            return (
              <li key={item.href}>
                {item.available ? (
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60"
                    )}
                  >
                    {content}
                  </Link>
                ) : (
                  <span className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground">
                    {content}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t p-3">
        <p className="truncate px-1 text-sm font-medium">{user.fullName}</p>
        <p className="px-1 text-xs text-muted-foreground">{user.roleName}</p>
        <form action={logoutAction} className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            className="w-full justify-start"
          >
            <LogOut className="size-4" />
            Keluar
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b px-4 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(!open)}
          aria-label="Menu navigasi"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
        <span className="text-base font-semibold">POS DNAE</span>
      </div>
      <aside className="hidden w-60 shrink-0 border-r bg-background lg:block">
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-background shadow-lg">
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}

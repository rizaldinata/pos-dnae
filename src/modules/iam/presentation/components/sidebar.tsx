"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Store,
  Package,
  Boxes,
  Users,
  ShoppingCart,
  Ticket,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  Wallet,
} from "lucide-react";
import { logoutAction } from "@/modules/iam/presentation/actions/auth.action";
import { SwitchCashierButton } from "@/modules/iam/presentation/components/switch-cashier-button";
import { ThemeToggle } from "@/modules/iam/presentation/components/theme-toggle";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";

export interface SidebarUser {
  fullName: string;
  roleName: string;
  permissions: string[];
  lowStockCount?: number;
  expiringCount?: number;
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
    available: true,
  },
  {
    href: "/pembelian/po",
    label: "Pembelian",
    icon: ShoppingCart,
    requiredPermissions: ["purchasing.manage"],
    available: true,
    activePrefixes: ["/pembelian"],
  },
  {
    href: "/promo",
    label: "Promo",
    icon: Ticket,
    requiredPermissions: ["promo.manage"],
    available: true,
    activePrefixes: ["/promo"],
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
    href: "/keuangan",
    label: "Keuangan",
    icon: Wallet,
    requiredPermissions: ["finance.manage", "report.view"],
    available: true,
    activePrefixes: ["/keuangan"],
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
  const [loggingOut, startLogout] = useTransition();

  const visibleItems = MENU_ITEMS.filter((item) =>
    canSee(item, user.permissions)
  );

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4 text-sidebar-foreground">
        <Image
          src="/logo.png"
          alt=""
          width={28}
          height={28}
          className="size-7 shrink-0"
        />
        <span className="text-base font-semibold">DNA COMPANY</span>
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-hover"
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
                  <Badge
                    variant="secondary"
                    className="border-sidebar-border bg-sidebar-hover text-[10px] text-sidebar-foreground"
                  >
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
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-hover"
                    )}
                  >
                    {content}
                    {item.href === "/stok" && (user.lowStockCount ?? 0) > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {user.lowStockCount}
                      </Badge>
                    )}
                    {item.href === "/stok" && (user.expiringCount ?? 0) > 0 && (
                      <Badge
                        className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400"
                        title="Batch mendekati / sudah kedaluwarsa"
                      >
                        {user.expiringCount}
                      </Badge>
                    )}
                  </Link>
                ) : (
                  <span className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/60">
                    {content}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-sidebar-border p-3 text-sidebar-foreground">
        <p className="truncate px-1 text-sm font-medium">{user.fullName}</p>
        <p className="px-1 text-xs text-sidebar-foreground/70">
          {user.roleName}
        </p>
        <div className="mt-1 flex flex-col gap-1">
          <ThemeToggle className="hover:bg-sidebar-hover" />
          <SwitchCashierButton />
          <form action={() => startLogout(() => logoutAction())}>
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              loading={loggingOut}
              className="w-full justify-start hover:bg-sidebar-hover"
            >
              <LogOut className="size-4" />
              Keluar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(!open)}
          aria-label="Menu navigasi"
          className="hover:bg-sidebar-hover"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
        <Image
          src="/logo.png"
          alt=""
          width={28}
          height={28}
          className="size-7 shrink-0"
        />
        <span className="text-base font-semibold">DNA COMPANY</span>
      </div>
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar shadow-lg">
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}

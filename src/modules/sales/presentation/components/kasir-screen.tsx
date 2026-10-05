"use client";

import { useEffect } from "react";
import { useCartStore } from "@/modules/sales/presentation/hooks/use-cart-store";
import { POSProductSearch } from "@/modules/sales/presentation/components/pos-product-search";
import { CartPanel } from "@/modules/sales/presentation/components/cart-panel";
import { Badge } from "@/shared/ui/badge";

export function KasirScreen({
  userName,
  roleName,
}: {
  userName: string;
  roleName: string;
}) {
  const setRole = useCartStore((s) => s.setRole);

  useEffect(() => {
    setRole(roleName);
  }, [roleName, setRole]);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 lg:h-[calc(100vh-4rem)] lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col gap-3 lg:basis-3/5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Kasir</h1>
          <Badge variant="secondary">
            {userName} • {roleName}
          </Badge>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <POSProductSearch onBarcode={() => {}} />
        </div>
      </section>
      <section className="flex min-h-0 flex-1 lg:basis-2/5">
        <CartPanel />
      </section>
    </div>
  );
}

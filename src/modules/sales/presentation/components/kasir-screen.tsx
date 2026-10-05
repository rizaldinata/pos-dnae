"use client";

import { useCallback, useEffect, useState } from "react";
import { useCartStore } from "@/modules/sales/presentation/hooks/use-cart-store";
import { POSProductSearch } from "@/modules/sales/presentation/components/pos-product-search";
import { CartPanel } from "@/modules/sales/presentation/components/cart-panel";
import { OpenShiftDialog } from "@/modules/shifts/presentation/components/open-shift-dialog";
import { CloseShiftDialog } from "@/modules/shifts/presentation/components/close-shift-dialog";
import { CashMovementDialog } from "@/modules/shifts/presentation/components/cash-movement-dialog";
import {
  getCurrentShiftAction,
  type ShiftDTO,
} from "@/modules/shifts/presentation/actions/shift.action";
import { Badge } from "@/shared/ui/badge";
import { formatRupiah } from "@/shared/lib/format-rupiah";

function formatDuration(sinceIso: string, now: number): string {
  const minutes = Math.max(
    Math.floor((now - new Date(sinceIso).getTime()) / 60000),
    0
  );
  const hours = Math.floor(minutes / 60);
  if (hours === 0) {
    return `${minutes} mnt`;
  }
  return `${hours} jam ${minutes % 60} mnt`;
}

export function KasirScreen({
  userName,
  roleName,
  initialShift,
}: {
  userName: string;
  roleName: string;
  initialShift: ShiftDTO | null;
}) {
  const setRole = useCartStore((s) => s.setRole);
  const [shift, setShift] = useState<ShiftDTO | null>(initialShift);
  const [now, setNow] = useState(() => Date.now());

  const refreshShift = useCallback(async () => {
    const current = await getCurrentShiftAction();
    setShift(current);
  }, []);

  useEffect(() => {
    setRole(roleName);
  }, [roleName, setRole]);

  useEffect(() => {
    if (!shift) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [shift]);

  const needsShift = !shift;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4 lg:h-[calc(100vh-4rem)] lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col gap-3 lg:basis-3/5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">Kasir</h1>
          <Badge variant="secondary">
            {userName} • {roleName}
          </Badge>
          {shift && (
            <Badge variant="default">
              Shift {formatDuration(shift.openedAt, now)} • Modal{" "}
              {formatRupiah(shift.openingCash)}
            </Badge>
          )}
          {shift && (
            <div className="flex gap-2">
              <CashMovementDialog
                shiftId={shift.id}
                onRecorded={refreshShift}
              />
              <CloseShiftDialog shift={shift} onClosed={refreshShift} />
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <POSProductSearch onBarcode={() => {}} />
        </div>
      </section>
      <section className="flex min-h-0 flex-1 lg:basis-2/5">
        <CartPanel />
      </section>
      {needsShift && (
        <OpenShiftDialog forced={true} onOpened={(s) => setShift(s)} />
      )}
    </div>
  );
}

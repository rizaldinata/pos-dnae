"use client";

import { useState, useTransition } from "react";
import { openShiftAction } from "@/modules/shifts/presentation/actions/shift.action";
import type { ShiftDTO } from "@/modules/shifts/presentation/actions/shift.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { formatRupiah } from "@/shared/lib/format-rupiah";

export function OpenShiftDialog({
  forced,
  onOpened,
}: {
  forced: boolean;
  onOpened: (shift: ShiftDTO) => void;
}) {
  const [open, setOpen] = useState(forced);
  const [modal, setModal] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    startTransition(async () => {
      const result = await openShiftAction(Math.round(Number(modal) || 0));
      if (!result.success || !result.shift) {
        setMessage(result.message ?? "Gagal membuka shift");
        return;
      }
      setOpen(false);
      onOpened(result.shift);
    });
  }

  return (
    <Dialog
      open={forced || open}
      onOpenChange={(isOpen) => {
        if (!forced) {
          setOpen(isOpen);
        }
      }}
    >
      <DialogContent onPointerDownOutside={(e) => forced && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Buka shift kasir</DialogTitle>
          <DialogDescription>
            Transaksi hanya dapat dilakukan selama shift terbuka. Masukkan modal
            awal laci kas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="opening-cash" className="text-sm font-medium">
            Modal awal
          </label>
          <Input
            id="opening-cash"
            type="number"
            min={0}
            value={modal}
            onChange={(e) => setModal(e.target.value)}
            disabled={pending}
            placeholder="cth. 100000"
            className="min-h-11 text-lg"
          />
          <div className="flex flex-wrap gap-2">
            {[0, 50000, 100000, 200000].map((nominal) => (
              <Button
                key={nominal}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setModal(String(nominal))}
              >
                {nominal === 0 ? "Tanpa modal" : formatRupiah(nominal)}
              </Button>
            ))}
          </div>
        </div>
        {message && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}
        <DialogFooter>
          <Button
            onClick={handleOpen}
            loading={pending}
            disabled={pending}
            className="min-h-11"
          >
            {pending ? "Membuka..." : "Buka shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustStockAction } from "@/modules/inventory/presentation/actions/opname.action";
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

export function AdjustStockDialog({
  variantId,
  sku,
  currentQty,
}: {
  variantId: string;
  sku: string;
  currentQty: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newQty, setNewQty] = useState(String(currentQty));
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAdjust() {
    startTransition(async () => {
      const result = await adjustStockAction(
        variantId,
        Math.floor(Number(newQty) || 0),
        reason
      );
      if (!result.success) {
        setMessage(result.message ?? "Penyesuaian gagal");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const diff = Math.floor(Number(newQty) || 0) - currentQty;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Sesuaikan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sesuaikan stok {sku}</DialogTitle>
            <DialogDescription>
              Stok sistem saat ini: {currentQty}. Selisih dicatat sebagai
              pergerakan penyesuaian.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="adjust-qty" className="text-sm font-medium">
                Stok baru (fisik)
              </label>
              <Input
                id="adjust-qty"
                type="number"
                min={0}
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                disabled={pending}
                className="min-h-11"
              />
              <p className="text-xs text-muted-foreground">
                Selisih:{" "}
                {diff === 0
                  ? "0 (tidak ada perubahan)"
                  : `${diff > 0 ? "+" : ""}${diff}`}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="adjust-reason" className="text-sm font-medium">
                Alasan (wajib)
              </label>
              <Input
                id="adjust-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                placeholder="cth. rusak / hilang / koreksi"
                className="min-h-11"
              />
            </div>
          </div>
          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button
              onClick={handleAdjust}
              loading={pending}
              disabled={pending || reason.trim() === ""}
              className="min-h-11"
            >
              {pending ? "Menyimpan..." : "Simpan penyesuaian"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

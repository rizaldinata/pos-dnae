"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidSaleAction } from "@/modules/sales/presentation/actions/void-return.action";
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

export function VoidSaleDialog({
  saleId,
  invoiceNo,
}: {
  saleId: string;
  invoiceNo: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleVoid() {
    startTransition(async () => {
      const result = await voidSaleAction(saleId, reason);
      if (!result.success) {
        setMessage(result.message ?? "Void gagal");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        className="min-h-11"
      >
        Void transaksi
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void {invoiceNo}?</DialogTitle>
            <DialogDescription>
              Seluruh transaksi dibatalkan dan stok dikembalikan. Tindakan ini
              tercatat di audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="void-reason" className="text-sm font-medium">
              Alasan void (wajib)
            </label>
            <Input
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
              placeholder="cth. salah input kasir"
              className="min-h-11"
            />
          </div>
          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoid}
              disabled={pending || reason.trim() === ""}
            >
              {pending ? "Memproses..." : "Ya, void"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

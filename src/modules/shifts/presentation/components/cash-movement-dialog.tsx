"use client";

import { useState, useTransition } from "react";
import { addCashMovementAction } from "@/modules/shifts/presentation/actions/shift.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

export function CashMovementDialog({
  shiftId,
  onRecorded,
}: {
  shiftId: string;
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await addCashMovementAction(
        shiftId,
        type,
        Math.round(Number(amount) || 0),
        note || undefined
      );
      if (!result.success) {
        setMessage(result.message ?? "Gagal mencatat");
        return;
      }
      setOpen(false);
      setAmount("");
      setNote("");
      onRecorded();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="min-h-11"
      >
        Kas masuk/keluar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kas masuk / keluar</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              {(["in", "out"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={type === t ? "default" : "outline"}
                  onClick={() => setType(t)}
                  disabled={pending}
                  className="min-h-11 flex-1"
                >
                  {t === "in" ? "Kas masuk" : "Kas keluar"}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="cash-amount" className="text-sm font-medium">
                Nominal
              </label>
              <Input
                id="cash-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={pending}
                className="min-h-11 text-lg"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="cash-note" className="text-sm font-medium">
                Catatan
              </label>
              <Input
                id="cash-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={pending}
                placeholder="cth. setoran / beli plastik"
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
              onClick={handleSubmit}
              disabled={pending || Math.round(Number(amount) || 0) <= 0}
              className="min-h-11"
            >
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

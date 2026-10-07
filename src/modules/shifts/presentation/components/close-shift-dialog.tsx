"use client";

import { useEffect, useState, useTransition } from "react";
import {
  closeShiftAction,
  getShiftSummaryAction,
  type ShiftDTO,
  type ShiftSummaryDTO,
} from "@/modules/shifts/presentation/actions/shift.action";
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

export function CloseShiftDialog({
  shift,
  onClosed,
}: {
  shift: ShiftDTO;
  onClosed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<ShiftSummaryDTO | null>(null);
  const [closing, setClosing] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    getShiftSummaryAction(shift.id).then((data) => {
      if (!cancelled) {
        setSummary(data);
        if (data) {
          setClosing((prev) => prev || String(data.expectedCash));
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, shift.id]);

  const closingAmount = Math.round(Number(closing) || 0);
  const difference = summary ? closingAmount - summary.expectedCash : 0;
  const needsNote = difference !== 0 && note.trim() === "";

  function handleClose() {
    startTransition(async () => {
      const result = await closeShiftAction(
        shift.id,
        closingAmount,
        note || undefined
      );
      if (!result.success) {
        setMessage(result.message ?? "Gagal menutup shift");
        return;
      }
      setOpen(false);
      onClosed();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSummary(null);
          setMessage(null);
          setClosing("");
          setNote("");
          setOpen(true);
        }}
        className="min-h-11"
      >
        Tutup shift
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tutup shift</DialogTitle>
            <DialogDescription>
              Hitung uang fisik di laci lalu masukkan jumlahnya
            </DialogDescription>
          </DialogHeader>
          {summary ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3">
                <span className="text-muted-foreground">Modal awal</span>
                <span className="text-right">
                  {formatRupiah(summary.shift.openingCash)}
                </span>
                <span className="text-muted-foreground">Penjualan tunai</span>
                <span className="text-right">
                  {formatRupiah(summary.cashSales)}
                </span>
                <span className="text-muted-foreground">Kas masuk</span>
                <span className="text-right">
                  {formatRupiah(summary.cashIn)}
                </span>
                <span className="text-muted-foreground">Kas keluar</span>
                <span className="text-right">
                  -{formatRupiah(summary.cashOut)}
                </span>
                <span className="text-muted-foreground">Kembalian</span>
                <span className="text-right">
                  -{formatRupiah(summary.changeGiven)}
                </span>
                <span className="font-semibold">Kas ekspektasi</span>
                <span className="text-right font-semibold">
                  {formatRupiah(summary.expectedCash)}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="closing-cash" className="text-sm font-medium">
                  Uang fisik dihitung
                </label>
                <Input
                  id="closing-cash"
                  type="number"
                  min={0}
                  value={closing}
                  onChange={(e) => setClosing(e.target.value)}
                  disabled={pending}
                  className="min-h-11 text-lg"
                />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selisih</span>
                <span
                  className={`font-semibold ${difference === 0 ? "" : difference > 0 ? "text-green-600" : "text-destructive"}`}
                >
                  {difference === 0
                    ? "Pas"
                    : `${difference > 0 ? "+" : ""}${formatRupiah(difference)}`}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="close-note" className="text-sm font-medium">
                  Catatan{" "}
                  {difference !== 0 && (
                    <span className="text-destructive">
                      (wajib bila ada selisih)
                    </span>
                  )}
                </label>
                <Input
                  id="close-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={pending}
                  placeholder="cth. selisih parkir..."
                  className="min-h-11"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Memuat rekap...</p>
          )}
          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button
              onClick={handleClose}
              loading={pending}
              disabled={pending || !summary || needsNote}
              className="min-h-11"
            >
              {pending ? "Menutup..." : "Tutup shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

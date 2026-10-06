"use client";

import { useState, useTransition } from "react";
import { adjustPointsAction } from "@/modules/customers/presentation/actions/loyalty.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { toast } from "@/shared/ui/toast";
import { formatDateTimeJakarta } from "@/shared/lib/date";

export interface LoyaltyHistoryItemDTO {
  id: string;
  points: number;
  type: string;
  note: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  earn: "Perolehan",
  redeem: "Penukaran",
  adjust: "Penyesuaian",
};

const TYPE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  earn: "default",
  redeem: "secondary",
  adjust: "outline",
};

/**
 * Riwayat poin per pelanggan (CUS-02) + penyesuaian manual oleh admin.
 * Perolehan/penukaran dicatat atomik oleh RPC saat checkout.
 */
export function LoyaltyHistory({
  customerId,
  customerName,
  balance,
  items,
}: {
  customerId: string;
  customerName: string;
  balance: number;
  items: LoyaltyHistoryItemDTO[];
}) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const value = Math.trunc(Number(points) || 0);
    if (value === 0) {
      toast({
        variant: "destructive",
        title: "Poin tidak valid",
        description: "Jumlah poin tidak boleh 0",
      });
      return;
    }
    if (!note.trim()) {
      toast({
        variant: "destructive",
        title: "Alasan wajib diisi",
        description: "Tuliskan alasan penyesuaian poin",
      });
      return;
    }
    startTransition(async () => {
      const result = await adjustPointsAction({
        customerId,
        points: value,
        note: note.trim(),
      });
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Penyesuaian ditolak",
          description: result.message ?? "Gagal menyesuaikan poin",
        });
        return;
      }
      toast({
        title: "Poin disesuaikan",
        description: `${value > 0 ? "+" : ""}${value} poin untuk ${customerName}`,
      });
      setOpen(false);
      setPoints("");
      setNote("");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Saldo poin</p>
          <p className="text-2xl font-bold">{balance}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="min-h-11">
              Sesuaikan poin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sesuaikan poin — {customerName}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="adjust-points" className="text-sm font-medium">
                  Jumlah poin (positif menambah, negatif mengurangi)
                </label>
                <Input
                  id="adjust-points"
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  disabled={pending}
                  placeholder="mis. 50 atau -20"
                  className="min-h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="adjust-note" className="text-sm font-medium">
                  Alasan
                </label>
                <Input
                  id="adjust-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={pending}
                  placeholder="mis. Kompensasi keterlambatan"
                  className="min-h-11"
                />
              </div>
              <Button
                onClick={submit}
                disabled={pending || !points.trim() || !note.trim()}
                className="min-h-11"
              >
                {pending ? "Menyimpan..." : "Simpan penyesuaian"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead className="text-right">Poin</TableHead>
              <TableHead>Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTimeJakarta(new Date(item.createdAt))}
                </TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[item.type] ?? "outline"}>
                    {TYPE_LABEL[item.type] ?? item.type}
                  </Badge>
                </TableCell>
                <TableCell
                  className={`text-right font-medium ${item.points < 0 ? "text-destructive" : "text-green-600"}`}
                >
                  {item.points > 0 ? `+${item.points}` : item.points}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.note ?? "-"}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  Belum ada riwayat poin
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

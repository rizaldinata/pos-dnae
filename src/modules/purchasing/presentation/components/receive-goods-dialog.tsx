"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { receiveGoodsAction } from "@/modules/purchasing/presentation/actions/purchasing.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

export interface ReceivableRow {
  variantId: string;
  displayName: string;
  sku: string;
  remaining: number;
  costPrice: number;
}

export function ReceiveGoodsDialog({
  poId,
  items,
}: {
  poId: string;
  items: ReceivableRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [batchNos, setBatchNos] = useState<Record<string, string>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReceive() {
    const payload = items
      .map((item) => ({
        variantId: item.variantId,
        qty: Number(quantities[item.variantId] ?? item.remaining) || 0,
        costPrice: Math.round(
          Number(costs[item.variantId] ?? item.costPrice) || 0
        ),
        batchNo: batchNos[item.variantId] ?? "",
        expiryDate: expiryDates[item.variantId] || null,
      }))
      .filter((entry) => entry.qty > 0);
    if (payload.length === 0) {
      setMessage("Isi qty terima minimal 1 item");
      return;
    }
    startTransition(async () => {
      const result = await receiveGoodsAction({ poId, items: payload, note });
      if (!result.success) {
        setMessage(result.message ?? "Penerimaan gagal");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="min-h-11">
        Terima barang
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Penerimaan barang</DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.variantId} className="rounded-md border p-2">
                <p className="text-sm font-medium">
                  {item.displayName}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.sku}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Sisa: {item.remaining}
                </p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Input
                    aria-label={`Qty terima ${item.sku}`}
                    type="number"
                    min={0}
                    max={item.remaining}
                    value={quantities[item.variantId] ?? String(item.remaining)}
                    onChange={(e) =>
                      setQuantities((prev) => ({
                        ...prev,
                        [item.variantId]: e.target.value,
                      }))
                    }
                    disabled={pending}
                    placeholder="Qty"
                  />
                  <Input
                    aria-label={`Harga beli ${item.sku}`}
                    type="number"
                    min={0}
                    value={costs[item.variantId] ?? String(item.costPrice)}
                    onChange={(e) =>
                      setCosts((prev) => ({
                        ...prev,
                        [item.variantId]: e.target.value,
                      }))
                    }
                    disabled={pending}
                    placeholder="Harga"
                  />
                  <Input
                    aria-label={`Batch ${item.sku}`}
                    value={batchNos[item.variantId] ?? ""}
                    onChange={(e) =>
                      setBatchNos((prev) => ({
                        ...prev,
                        [item.variantId]: e.target.value,
                      }))
                    }
                    disabled={pending}
                    placeholder="Batch (opsional)"
                  />
                  <Input
                    aria-label={`Kedaluwarsa ${item.sku}`}
                    type="date"
                    value={expiryDates[item.variantId] ?? ""}
                    onChange={(e) =>
                      setExpiryDates((prev) => ({
                        ...prev,
                        [item.variantId]: e.target.value,
                      }))
                    }
                    disabled={pending}
                    aria-describedby={`expiry-hint-${item.variantId}`}
                  />
                </div>
                <p
                  id={`expiry-hint-${item.variantId}`}
                  className="mt-1 text-[11px] text-muted-foreground"
                >
                  Kedaluwarsa (opsional) — mengaktifkan pelacakan FEFO &amp;
                  peringatan
                </p>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            <label htmlFor="gr-note" className="text-sm font-medium">
              Catatan
            </label>
            <Input
              id="gr-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={pending}
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
              onClick={handleReceive}
              disabled={pending}
              className="min-h-11"
            >
              {pending ? "Menyimpan..." : "Simpan penerimaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

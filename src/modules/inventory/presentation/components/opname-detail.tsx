"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveOpnameAction,
  updateOpnameItemAction,
} from "@/modules/inventory/presentation/actions/opname.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

export interface OpnameItemRow {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  systemQty: number;
  actualQty: number;
  diff: number;
}

export function OpnameDetail({
  opnameId,
  code,
  status,
  items,
  canApprove,
}: {
  opnameId: string;
  code: string;
  status: string;
  items: OpnameItemRow[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  const approved = status === "approved";
  const diffCount = items.filter((i) => i.diff !== 0).length;

  function saveItem(variantId: string, actualQty: number) {
    setSavingId(variantId);
    startTransition(async () => {
      const result = await updateOpnameItemAction(
        opnameId,
        variantId,
        actualQty
      );
      if (!result.success) {
        setMessage(result.message ?? "Gagal menyimpan");
      }
      setSavingId(null);
      router.refresh();
    });
  }

  function handleApprove() {
    if (
      !confirm(`Setujui opname ${code}? ${diffCount} varian akan disesuaikan.`)
    ) {
      return;
    }
    startTransition(async () => {
      const result = await approveOpnameAction(opnameId);
      setMessage(result.message);
      if (result.success) {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={approved ? "default" : "secondary"}>
            {approved ? "Disetujui" : "Draft"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {diffCount} varian berselisih
          </span>
        </div>
        {canApprove && !approved && (
          <Button
            onClick={handleApprove}
            disabled={pending}
            className="min-h-11"
          >
            {pending ? "Memproses..." : "Setujui & sesuaikan stok"}
          </Button>
        )}
      </div>

      {message && (
        <p
          role={message.includes("disetujui") ? "status" : "alert"}
          className="text-sm text-muted-foreground"
        >
          {message}
        </p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produk</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Sistem</TableHead>
              <TableHead className="text-right">Fisik</TableHead>
              <TableHead className="text-right">Selisih</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.variantId}>
                <TableCell className="font-medium">
                  {item.productName}
                  {item.variantName ? ` — ${item.variantName}` : ""}
                </TableCell>
                <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                <TableCell className="text-right">{item.systemQty}</TableCell>
                <TableCell className="text-right">
                  {approved ? (
                    item.actualQty
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      defaultValue={item.actualQty}
                      disabled={pending}
                      aria-label={`Stok fisik ${item.sku}`}
                      onBlur={(e) => {
                        const next = Math.floor(Number(e.target.value) || 0);
                        if (next !== item.actualQty) {
                          saveItem(item.variantId, next);
                        }
                      }}
                      className="ml-auto h-9 w-24 text-right"
                    />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {item.diff === 0 ? (
                    <span className="text-muted-foreground">0</span>
                  ) : (
                    <span
                      className={
                        item.diff > 0 ? "text-green-600" : "text-destructive"
                      }
                    >
                      {item.diff > 0 ? `+${item.diff}` : item.diff}
                      {savingId === item.variantId ? " ..." : ""}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

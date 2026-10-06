"use client";

import { useState, useTransition } from "react";
import {
  createPurchaseReturnAction,
  listSuppliersAction,
  type SupplierDTO,
} from "@/modules/purchasing/presentation/actions/purchasing.action";
import { searchProductsPOSAction } from "@/modules/sales/presentation/actions/pos-search.action";
import type { POSVariant } from "@/modules/sales/application/use-cases/search-products-pos.use-case";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import { formatDateTimeJakarta } from "@/shared/lib/date";

export interface PurchaseReturnRow {
  id: string;
  returnNo: string;
  reason: string;
  totalRefund: number;
  createdAt: string;
}

export function PurchaseReturnManagement({
  suppliers,
  returns,
}: {
  suppliers: SupplierDTO[];
  returns: PurchaseReturnRow[];
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<{ variant: POSVariant; qty: string }[]>(
    []
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<POSVariant[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSearch(next: string) {
    setQuery(next);
    if (!next.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const products = await searchProductsPOSAction(next.trim(), 10);
      setResults(products.flatMap((p) => p.variants));
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createPurchaseReturnAction({
        supplierId,
        reason,
        items: items.map((i) => ({
          variantId: i.variant.variantId,
          qty: Number(i.qty) || 0,
          costPrice: i.variant.costPrice,
        })),
      });
      if (!result.success) {
        setMessage(result.message ?? "Retur gagal");
        return;
      }
      setMessage(result.message);
      setItems([]);
      setReason("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Retur ke Supplier</h1>
        <p className="text-sm text-muted-foreground">
          Kembalikan barang cacat/berlebih, stok berkurang
        </p>
      </div>

      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Retur baru</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="pr-supplier" className="text-sm font-medium">
                Supplier
              </label>
              <select
                id="pr-supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                disabled={pending}
                className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="pr-reason" className="text-sm font-medium">
                Alasan
              </label>
              <Input
                id="pr-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                className="min-h-11"
                placeholder="cth. barang rusak"
              />
            </div>
          </div>

          <div className="relative">
            <Input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cari varian..."
              className="min-h-11"
              aria-label="Cari varian untuk retur"
            />
            {results.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-background shadow-lg">
                {results.map((v) => (
                  <li key={v.variantId}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setItems((prev) =>
                          prev.some((i) => i.variant.variantId === v.variantId)
                            ? prev
                            : [...prev, { variant: v, qty: "1" }]
                        );
                        setQuery("");
                        setResults([]);
                      }}
                    >
                      <span>
                        {v.displayName}{" "}
                        <span className="font-mono text-xs text-muted-foreground">
                          {v.sku}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Stok {v.stockQty ?? "-"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.map((entry, index) => (
            <div
              key={entry.variant.variantId}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {entry.variant.displayName}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {entry.variant.sku}
                </p>
              </div>
              <Input
                aria-label="Qty retur"
                type="number"
                min={1}
                value={entry.qty}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, qty: e.target.value } : row
                    )
                  )
                }
                disabled={pending}
                className="h-11 w-24 text-right"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  setItems((prev) => prev.filter((_, i) => i !== index))
                }
              >
                Hapus
              </Button>
            </div>
          ))}

          <Button
            onClick={handleSubmit}
            disabled={
              pending ||
              items.length === 0 ||
              !supplierId ||
              reason.trim() === ""
            }
            className="min-h-11"
          >
            {pending ? "Menyimpan..." : "Catat retur"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat retur</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. retur</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      {r.returnNo}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTimeJakarta(r.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {r.reason}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(r.totalRefund)}
                    </TableCell>
                  </TableRow>
                ))}
                {returns.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      Belum ada retur
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

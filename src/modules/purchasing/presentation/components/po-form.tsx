"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPOAction } from "@/modules/purchasing/presentation/actions/purchasing.action";
import { searchProductsPOSAction } from "@/modules/sales/presentation/actions/pos-search.action";
import type { POSVariant } from "@/modules/sales/application/use-cases/search-products-pos.use-case";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { formatRupiah } from "@/shared/lib/format-rupiah";

export interface POItemRow {
  variantId: string;
  displayName: string;
  sku: string;
  qty: string;
  costPrice: string;
}

export function POForm({
  suppliers,
}: {
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItemRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<POSVariant[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  function handleSearch(next: string) {
    setQuery(next);
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    if (!next.trim()) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(() => {
      startTransition(async () => {
        const products = await searchProductsPOSAction(next.trim(), 10);
        setResults(products.flatMap((p) => p.variants));
      });
    }, 300);
  }

  function addVariant(variant: POSVariant) {
    setItems((prev) => {
      if (prev.some((i) => i.variantId === variant.variantId)) {
        return prev;
      }
      return [
        ...prev,
        {
          variantId: variant.variantId,
          displayName: variant.displayName,
          sku: variant.sku,
          qty: "1",
          costPrice: String(variant.costPrice),
        },
      ];
    });
    setQuery("");
    setResults([]);
  }

  const total = items.reduce(
    (sum, i) => sum + (Number(i.qty) || 0) * (Number(i.costPrice) || 0),
    0
  );

  function handleSubmit() {
    startTransition(async () => {
      const result = await createPOAction({
        supplierId,
        notes,
        items: items.map((i) => ({
          variantId: i.variantId,
          qty: Number(i.qty) || 0,
          costPrice: Math.round(Number(i.costPrice) || 0),
        })),
      });
      if (!result.success || !result.poId) {
        setMessage(result.message ?? "Gagal membuat PO");
        return;
      }
      router.push(`/pembelian/po/${result.poId}`);
    });
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Info PO</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="po-supplier" className="text-sm font-medium">
                Supplier
              </label>
              <select
                id="po-supplier"
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
              <label htmlFor="po-notes" className="text-sm font-medium">
                Catatan
              </label>
              <Input
                id="po-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
                className="min-h-11"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item PO ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cari varian (nama/SKU/barcode)..."
              className="min-h-11"
              aria-label="Cari varian untuk PO"
            />
            {results.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-background shadow-lg">
                {results.map((v) => (
                  <li key={v.variantId}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => addVariant(v)}
                    >
                      <span>
                        {v.displayName}{" "}
                        <span className="font-mono text-xs text-muted-foreground">
                          {v.sku}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        {formatRupiah(v.costPrice)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.map((item, index) => (
            <div
              key={item.variantId}
              className="flex flex-wrap items-center gap-2 rounded-md border p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {item.displayName}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {item.sku}
                </p>
              </div>
              <Input
                aria-label="Qty PO"
                type="number"
                min={1}
                value={item.qty}
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
              <Input
                aria-label="Harga beli"
                type="number"
                min={0}
                value={item.costPrice}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, costPrice: e.target.value } : row
                    )
                  )
                }
                disabled={pending}
                className="h-11 w-32 text-right"
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
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Belum ada item. Cari varian di atas.
            </p>
          )}

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm font-medium">
              Estimasi total: {formatRupiah(Math.round(total))}
            </span>
            <Button
              onClick={handleSubmit}
              disabled={pending || items.length === 0 || !supplierId}
              className="min-h-11"
            >
              {pending ? "Menyimpan..." : "Buat PO"}
            </Button>
          </div>
          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

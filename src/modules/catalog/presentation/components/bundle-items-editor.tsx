"use client";

import { useEffect, useState, useTransition } from "react";
import {
  saveBundleItemsAction,
  searchVariantsAction,
  type VariantOption,
} from "@/modules/catalog/presentation/actions/product.action";
import type { BundleComponent } from "@/modules/catalog/domain/repositories/bundle.repository";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";

interface ItemRow {
  variantId: string;
  qty: string;
  label: string;
  stockQty?: number;
}

function labelOf(c: {
  productName: string;
  variantName: string;
  sku: string;
}): string {
  return `${c.productName}${c.variantName ? ` — ${c.variantName}` : ""} (${c.sku})`;
}

/**
 * Form komponen bundle (Sub-PRD 4.1): pilih varian produk lain + qty.
 * Daftar yang disimpan berlaku untuk seluruh varian produk bundle.
 */
export function BundleItemsEditor({
  productId,
  initial,
}: {
  productId: string;
  initial: BundleComponent[];
}) {
  const [items, setItems] = useState<ItemRow[]>(
    initial.map((c) => ({
      variantId: c.variantId,
      qty: String(c.qty),
      label: labelOf(c),
      stockQty: c.stockQty,
    }))
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await searchVariantsAction({
        query: trimmed,
        excludeProductId: productId,
      });
      if (cancelled) {
        return;
      }
      setSearching(false);
      setResults(res.ok ? res.options : []);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, productId]);

  function addVariant(option: VariantOption) {
    setMessage(null);
    if (items.some((i) => i.variantId === option.variantId)) {
      setMessage({ text: "Komponen sudah ada di daftar", ok: false });
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        variantId: option.variantId,
        qty: "1",
        label: labelOf({
          productName: option.productName,
          variantName: option.variantName,
          sku: option.sku,
        }),
      },
    ]);
    setQuery("");
    setResults([]);
  }

  function handleSave() {
    const payload = items
      .map((i) => ({
        componentVariantId: i.variantId,
        qty: Math.floor(Number(i.qty) || 0),
      }))
      .filter((i) => i.qty > 0);
    if (payload.length !== items.length) {
      setMessage({ text: "Qty setiap komponen minimal 1", ok: false });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await saveBundleItemsAction({ productId, items: payload });
      if (!res.success) {
        setMessage({
          text: res.message ?? "Komponen gagal disimpan",
          ok: false,
        });
        return;
      }
      setMessage({
        text: res.message ?? "Komponen bundle disimpan",
        ok: true,
      });
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <div>
        <h2 className="text-base font-semibold">Komponen bundle</h2>
        <p className="text-sm text-muted-foreground">
          Pilih produk lain beserta qty per bundle. Berlaku untuk seluruh varian
          produk ini; saat terjual, stok komponen yang berkurang.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="bundle-search" className="text-sm font-medium">
          Tambah komponen
        </label>
        <Input
          id="bundle-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) {
              setResults([]);
            }
          }}
          placeholder="Cari nama produk atau SKU..."
          className="min-h-11"
          disabled={pending}
        />
        {searching && (
          <p className="text-xs text-muted-foreground">Mencari...</p>
        )}
        {results.length > 0 && (
          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border p-1">
            {results.map((r) => (
              <li key={r.variantId}>
                <button
                  type="button"
                  onClick={() => addVariant(r)}
                  disabled={pending}
                  className="flex min-h-10 w-full items-center justify-between rounded-md px-2 text-left text-sm hover:bg-accent"
                >
                  <span className="truncate">
                    {r.productName}
                    {r.variantName ? ` — ${r.variantName}` : ""}
                  </span>
                  <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                    {r.sku}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada komponen — bundle yang dijual tidak akan mengurangi stok apa
          pun.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.variantId}
              className="flex flex-wrap items-center gap-2 rounded-md border p-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {item.label}
              </span>
              {item.stockQty !== undefined && (
                <Badge variant="secondary" className="text-[10px]">
                  Stok {item.stockQty}
                </Badge>
              )}
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Qty
                <Input
                  type="number"
                  min={1}
                  value={item.qty}
                  disabled={pending}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((i) =>
                        i.variantId === item.variantId
                          ? { ...i, qty: e.target.value }
                          : i
                      )
                    )
                  }
                  className="h-9 w-20 text-right"
                  aria-label={`Qty ${item.label}`}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  setItems((prev) =>
                    prev.filter((i) => i.variantId !== item.variantId)
                  )
                }
              >
                Hapus
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="min-h-11"
        >
          {pending ? "Menyimpan..." : "Simpan komponen"}
        </Button>
        {message && (
          <p
            role="alert"
            className={`text-sm ${message.ok ? "text-green-600" : "text-destructive"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

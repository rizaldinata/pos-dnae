"use client";

import { useEffect, useState, useTransition } from "react";
import {
  searchLabelVariantsAction,
  type LabelVariantOption,
} from "@/modules/catalog/presentation/actions/product.action";
import { BarcodeSvg } from "@/modules/catalog/presentation/components/barcode-svg";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { formatRupiah } from "@/shared/lib/format-rupiah";

interface LabelItem extends LabelVariantOption {
  qty: number;
}

const SIZE_PRESETS = [
  { id: "50x30", label: "50 × 30 mm", width: "50mm", height: "30mm" },
  { id: "38x25", label: "38 × 25 mm", width: "38mm", height: "25mm" },
  { id: "60x40", label: "60 × 40 mm", width: "60mm", height: "40mm" },
  { id: "100x50", label: "100 × 50 mm", width: "100mm", height: "50mm" },
] as const;

type SizeId = (typeof SIZE_PRESETS)[number]["id"];

export function LabelPrinter() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LabelVariantOption[]>([]);
  const [items, setItems] = useState<LabelItem[]>([]);
  const [sizeId, setSizeId] = useState<SizeId>("50x30");
  const [showName, setShowName] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    const timer = window.setTimeout(() => {
      startSearch(async () => {
        const res = await searchLabelVariantsAction({ query: trimmed });
        if (res.ok) {
          setResults(res.options);
        }
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  function toggleItem(opt: LabelVariantOption) {
    setItems((prev) => {
      const exists = prev.find((i) => i.variantId === opt.variantId);
      if (exists) {
        return prev.filter((i) => i.variantId !== opt.variantId);
      }
      return [...prev, { ...opt, qty: 1 }];
    });
  }

  function setQty(variantId: string, qty: number) {
    setItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, qty } : i))
    );
  }

  function print() {
    window.print();
  }

  const totalLabels = items.reduce((sum, i) => sum + i.qty, 0);
  const size = SIZE_PRESETS.find((s) => s.id === sizeId) ?? SIZE_PRESETS[0];
  const flatLabels = items.flatMap((item) =>
    Array.from({ length: item.qty }, (_, idx) => ({
      ...item,
      key: `${item.variantId}-${idx}`,
    }))
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Cari Produk</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, SKU, atau barcode..."
            disabled={searching}
            aria-label="Cari produk untuk label"
          />
          {results.length > 0 && (
            <div className="rounded-md border">
              {results.map((opt) => {
                const selected = items.some(
                  (i) => i.variantId === opt.variantId
                );
                return (
                  <button
                    key={opt.variantId}
                    type="button"
                    onClick={() => toggleItem(opt)}
                    className={`flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50 ${
                      selected ? "bg-primary/10" : ""
                    }`}
                  >
                    <span>
                      {opt.productName}
                      {opt.variantName ? ` — ${opt.variantName}` : ""} (
                      {opt.sku})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {opt.barcode ?? "Tanpa barcode"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Produk Terpilih ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {items.map((item) => (
              <div
                key={item.variantId}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm">
                  {item.productName}
                  {item.variantName ? ` — ${item.variantName}` : ""} ({item.sku}
                  )
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) =>
                      setQty(
                        item.variantId,
                        Math.max(1, Number(e.target.value) || 1)
                      )
                    }
                    className="w-20"
                    aria-label={`Qty ${item.sku}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setItems((prev) =>
                        prev.filter((i) => i.variantId !== item.variantId)
                      )
                    }
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Label</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {SIZE_PRESETS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSizeId(s.id)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  sizeId === s.id
                    ? "border-primary bg-primary/10 font-medium"
                    : ""
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showName}
                onChange={(e) => setShowName(e.target.checked)}
              />
              Nama produk
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showSku}
                onChange={(e) => setShowSku(e.target.checked)}
              />
              SKU
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
              />
              Harga jual
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={print} disabled={totalLabels === 0}>
              Cetak {totalLabels} label
            </Button>
            <Badge variant="secondary">{size.label}</Badge>
          </div>
        </CardContent>
      </Card>

      {flatLabels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pratinjau ({flatLabels.length} label)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="label-print-area flex flex-wrap gap-2">
              {flatLabels.map((label) => (
                <div
                  key={label.key}
                  className="flex flex-col justify-between overflow-hidden border border-gray-300 bg-white p-1 text-black"
                  style={{ width: size.width, height: size.height }}
                >
                  <div className="flex-1 overflow-hidden">
                    <BarcodeSvg
                      value={label.barcode ?? label.sku}
                      showText={false}
                      className="h-full w-full"
                    />
                  </div>
                  {showName && (
                    <p className="truncate text-[7px] leading-tight">
                      {label.productName}
                      {label.variantName ? ` (${label.variantName})` : ""}
                    </p>
                  )}
                  {showSku && (
                    <p className="truncate font-mono text-[6px] leading-tight">
                      {label.sku}
                    </p>
                  )}
                  {showPrice && (
                    <p className="text-[8px] font-bold leading-tight">
                      {formatRupiah(label.sellPrice)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

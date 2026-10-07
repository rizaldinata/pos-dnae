"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { searchProductsPOSAction } from "@/modules/sales/presentation/actions/pos-search.action";
import type {
  POSProduct,
  POSVariant,
} from "@/modules/sales/application/use-cases/search-products-pos.use-case";
import { useCartStore } from "@/modules/sales/presentation/hooks/use-cart-store";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { toast, Toaster } from "@/shared/ui/toast";
import { formatRupiah } from "@/shared/lib/format-rupiah";

export function useBarcodeScanner(onScan: (code: string) => void) {
  const buffer = useRef<{ code: string; lastTime: number }>({
    code: "",
    lastTime: 0,
  });
  const callback = useRef(onScan);

  useEffect(() => {
    callback.current = onScan;
  }, [onScan]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      const now = performance.now();
      const state = buffer.current;
      if (now - state.lastTime > 50) {
        state.code = "";
      }
      state.lastTime = now;
      if (e.key === "Enter") {
        if (state.code.length >= 4) {
          e.preventDefault();
          callback.current(state.code);
        }
        state.code = "";
        return;
      }
      if (e.key.length === 1) {
        state.code += e.key;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

export function POSProductSearch({
  onBarcode,
}: {
  onBarcode: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<POSProduct[]>([]);
  const [searching, setSearching] = useState(true);
  const [variantPicker, setVariantPicker] = useState<POSProduct | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const [, startTransition] = useTransition();
  const requestIdRef = useRef(0);

  // Default: tampilkan daftar produk aktif (query kosong = tanpa filter,
  // urut nama A–Z, maks 50) supaya kasir tidak perlu mencari dulu. Saat
  // mengetik: debounce pencarian 300ms (maks 24 hasil). Guard requestId
  // mencegah respons lama menimpa permintaan yang lebih baru.
  useEffect(() => {
    const trimmed = query.trim();
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(
      () => {
        startTransition(async () => {
          const data = await searchProductsPOSAction(
            trimmed,
            trimmed ? 24 : 50
          );
          if (requestId !== requestIdRef.current) {
            return; // sudah ketinggalan oleh permintaan lebih baru
          }
          setResults(data);
          setSearching(false);
        });
      },
      trimmed ? 300 : 0
    );
    return () => clearTimeout(timer);
  }, [query]);

  // Petunjuk singkat di atas grid: bedakan daftar default, hasil pencarian,
  // dan kondisi kosong.
  function statusHint(): string {
    if (query.trim()) {
      return results.length > 0
        ? "Hasil pencarian"
        : "Tidak ada produk ditemukan";
    }
    return results.length > 0 ? "Produk tersedia" : "Belum ada produk tersedia";
  }

  function handleAddVariant(variant: POSVariant) {
    const error = addItem(variant);
    if (error) {
      toast({
        variant: "destructive",
        title: "Tidak dapat menambah",
        description: error,
      });
    } else {
      toast({ title: "Ditambahkan", description: variant.displayName });
    }
  }

  function handlePickProduct(product: POSProduct) {
    if (product.variants.length === 1 && product.variants[0]) {
      handleAddVariant(product.variants[0]);
      return;
    }
    setVariantPicker(product);
  }

  async function handleBarcode(code: string) {
    const data = await searchProductsPOSAction(code, 10);
    const exact = data
      .flatMap((p) => p.variants)
      .find(
        (v) => v.barcode === code || v.sku.toUpperCase() === code.toUpperCase()
      );
    if (exact) {
      handleAddVariant(exact);
    } else {
      toast({
        variant: "destructive",
        title: "Barcode tidak ditemukan",
        description: code,
      });
      onBarcode(code);
    }
  }

  useBarcodeScanner(handleBarcode);

  return (
    <div className="flex flex-col gap-3">
      <Input
        id="pos-search-input"
        value={query}
        onChange={(e) => {
          const value = e.target.value;
          setQuery(value);
          setSearching(true);
          if (!value.trim()) {
            // Kosongkan dulu; daftar default menyusul dari effect di atas.
            setResults([]);
          }
        }}
        placeholder="Cari nama, SKU, atau scan barcode..."
        className="min-h-12 text-base"
        aria-label="Cari produk kasir"
        autoFocus
      />
      {searching && (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {query.trim() ? "Mencari..." : "Memuat produk..."}
        </p>
      )}
      {!searching && (
        <p className="text-sm text-muted-foreground">{statusHint()}</p>
      )}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        {results.map((product) => {
          const cheapest = Math.min(
            ...product.variants.map((v) => v.sellPrice)
          );
          const totalStock = product.variants.reduce(
            (sum, v) => sum + (v.stockQty ?? 0),
            0
          );
          const outOfStock = product.variants.every(
            (v) => v.trackStock && (v.stockQty ?? 0) <= 0
          );
          return (
            <Card
              key={product.productId}
              className={`min-h-24 ${outOfStock ? "opacity-50" : "cursor-pointer hover:border-primary"}`}
              onClick={() => !outOfStock && handlePickProduct(product)}
            >
              <CardContent className="flex flex-col gap-1 p-3">
                <div className="flex items-start gap-2">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-10 w-10 shrink-0 rounded-md border object-cover"
                    />
                  ) : null}
                  <p className="text-sm font-medium leading-tight">
                    {product.name}
                    {product.variants.some((v) => v.isBundle) && (
                      <Badge variant="outline" className="ml-2 align-middle">
                        Bundle
                      </Badge>
                    )}
                  </p>
                </div>
                {product.variants.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {product.variants.length} varian
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {formatRupiah(cheapest)}
                  </span>
                  {outOfStock ? (
                    <Badge variant="destructive">Habis</Badge>
                  ) : (
                    <Badge variant="secondary">Stok {totalStock}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={variantPicker !== null}
        onOpenChange={(open) => !open && setVariantPicker(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pilih varian — {variantPicker?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {variantPicker?.variants.map((v) => {
              const empty = v.trackStock && (v.stockQty ?? 0) <= 0;
              const thumb = v.imageUrl ?? variantPicker.imageUrl;
              const tierHint =
                v.tiers.length > 0 && v.tiers[0]
                  ? ` • Grosir ≥${v.tiers[0].minQty}: ${formatRupiah(v.tiers[0].price)}`
                  : "";
              return (
                <Button
                  key={v.variantId}
                  variant="outline"
                  className="min-h-12 justify-between"
                  disabled={empty}
                  onClick={() => {
                    handleAddVariant(v);
                    setVariantPicker(null);
                  }}
                >
                  <span className="flex items-center gap-2">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt={`Foto ${v.variantName || v.sku}`}
                        className="h-8 w-8 shrink-0 rounded-md border object-cover"
                      />
                    ) : null}
                    {v.variantName || v.sku}
                  </span>
                  <span className="text-muted-foreground">
                    {formatRupiah(v.sellPrice)} •{" "}
                    {empty ? "Habis" : `Stok ${v.stockQty}`}
                    {tierHint}
                  </span>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}

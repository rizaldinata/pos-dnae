"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingBag,
  ShoppingCart,
  Search,
  Sparkles,
  Truck,
  Store,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowDown,
  Phone,
  MapPin,
  BadgeCheck,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  MessageCircle,
  PackageSearch,
  Check,
  Clock,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { formatRupiah } from "@/shared/lib/format-rupiah";
import type {
  StorefrontProduct,
  StorefrontVariant,
} from "@/modules/orders/domain/entities/order";
import { CheckoutDialog } from "./checkout-dialog";

export interface CartLine {
  variantId: string;
  productName: string;
  variantName: string;
  price: number;
  qty: number;
}

interface StorefrontProps {
  products: StorefrontProduct[];
  settings: {
    storeName: string;
    storeAddress: string;
    storePhone: string;
    storeLogoUrl: string;
  };
}

const MAX_QTY = 99;

function formatWhatsAppLink(phone: string, storeName: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("0")
    ? `62${digits.slice(1)}`
    : digits.startsWith("62")
      ? digits
      : `62${digits}`;
  const text = encodeURIComponent(
    `Halo ${storeName}, saya ingin bertanya seputar produk di katalog online.`
  );
  return `https://wa.me/${normalized}?text=${text}`;
}

export function Storefront({ products, settings }: StorefrontProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<
    "default" | "price-asc" | "price-desc" | "name-asc"
  >("default");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Modal detail & pilih varian
  const [activeProduct, setActiveProduct] = useState<StorefrontProduct | null>(
    null
  );
  const [selectedVariant, setSelectedVariant] =
    useState<StorefrontVariant | null>(null);
  const [modalQty, setModalQty] = useState(1);

  const categories = useMemo(() => {
    const names = products
      .map((p) => p.categoryName)
      .filter((name): name is string => name.trim() !== "");
    return [...new Set(names)];
  }, [products]);

  // Hitung jumlah produk per kategori
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      if (p.categoryName) {
        counts[p.categoryName] = (counts[p.categoryName] ?? 0) + 1;
      }
    }
    return counts;
  }, [products]);

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (category && product.categoryName !== category) {
        return false;
      }
      if (inStockOnly) {
        const hasAvailable = product.variants.some((v) => v.isAvailable);
        if (!hasAvailable) return false;
      }
      if (!q) {
        return true;
      }
      return (
        product.name.toLowerCase().includes(q) ||
        (product.description &&
          product.description.toLowerCase().includes(q)) ||
        product.variants.some((v) => v.name.toLowerCase().includes(q))
      );
    });

    if (sortBy === "price-asc") {
      return [...filtered].sort((a, b) => {
        const minA = Math.min(...a.variants.map((v) => v.sellPrice));
        const minB = Math.min(...b.variants.map((v) => v.sellPrice));
        return minA - minB;
      });
    }

    if (sortBy === "price-desc") {
      return [...filtered].sort((a, b) => {
        const minA = Math.min(...a.variants.map((v) => v.sellPrice));
        const minB = Math.min(...b.variants.map((v) => v.sellPrice));
        return minB - minA;
      });
    }

    if (sortBy === "name-asc") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [products, query, category, inStockOnly, sortBy]);

  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.qty * line.price, 0);

  function addToCart(
    product: StorefrontProduct,
    variant: StorefrontVariant,
    quantity = 1
  ) {
    if (!variant.isAvailable) {
      return;
    }
    setCart((prev) => {
      const existing = prev.find((line) => line.variantId === variant.id);
      if (existing) {
        return prev.map((line) =>
          line.variantId === variant.id
            ? { ...line, qty: Math.min(line.qty + quantity, MAX_QTY) }
            : line
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productName: product.name,
          variantName: variant.name,
          price: variant.sellPrice,
          qty: quantity,
        },
      ];
    });
    setActiveProduct(null);
    setSelectedVariant(null);
    setModalQty(1);
    setCartOpen(true);
  }

  function openProductDetail(product: StorefrontProduct) {
    const sellable = product.variants.filter((v) => v.isAvailable);
    setActiveProduct(product);
    setSelectedVariant(sellable[0] ?? product.variants[0] ?? null);
    setModalQty(1);
  }

  function handleQuickAdd(e: React.MouseEvent, product: StorefrontProduct) {
    e.stopPropagation();
    const sellable = product.variants.filter((v) => v.isAvailable);
    if (sellable.length === 0) return;

    if (sellable.length === 1 && sellable[0]) {
      addToCart(product, sellable[0], 1);
    } else {
      openProductDetail(product);
    }
  }

  function setQty(variantId: string, qty: number) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((line) => line.variantId !== variantId)
        : prev.map((line) =>
            line.variantId === variantId
              ? { ...line, qty: Math.min(qty, MAX_QTY) }
              : line
          )
    );
  }

  function removeFromCart(variantId: string) {
    setCart((prev) => prev.filter((line) => line.variantId !== variantId));
  }

  function handleOrdered(orderNo: string, phone: string) {
    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
    router.push(
      `/cek-pesanan/${encodeURIComponent(orderNo)}?phone=${encodeURIComponent(phone)}`
    );
  }

  const waLink = formatWhatsAppLink(
    settings.storePhone,
    settings.storeName || "Toko"
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* 1. Header / Navbar Utama Pelanggan */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo & Identitas Toko */}
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity hover:opacity-90"
          >
            {settings.storeLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.storeLogoUrl}
                alt={settings.storeName}
                className="size-10 rounded-xl border border-primary/20 object-cover shadow-sm"
              />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Store className="size-5" />
              </div>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-foreground sm:text-lg">
                  {settings.storeName || "DNAE Store"}
                </span>
                <BadgeCheck
                  className="size-4 text-emerald-500"
                  aria-label="Toko Resmi"
                />
              </div>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Buka Pesanan Online
              </span>
            </div>
          </Link>

          {/* Navigasi Desktop */}
          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#katalog"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Katalog Produk
            </a>
            <a
              href="#keunggulan"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Keunggulan
            </a>
            <a
              href="#cara-belanja"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cara Belanja
            </a>
            <a
              href="#kontak"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Lokasi & Kontak
            </a>
          </nav>

          {/* Action Kanan: Cek Pesanan & Tombol Keranjang */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border-border/80 px-3.5 hover:bg-muted"
            >
              <Link href="/cek-pesanan">
                <PackageSearch className="size-4 text-muted-foreground" />
                <span>Cek Pesanan</span>
              </Link>
            </Button>

            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="hidden lg:inline-flex items-center justify-center size-9 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                title="Hubungi Toko via WhatsApp"
              >
                <MessageCircle className="size-4" />
              </a>
            ) : null}

            {/* Tombol Keranjang */}
            <Button
              onClick={() => setCartOpen(true)}
              variant="default"
              size="sm"
              className="relative inline-flex items-center gap-2 rounded-full px-4 font-semibold shadow-md transition-all hover:scale-[1.02]"
              aria-label={`Buka Keranjang (${cartCount} item)`}
            >
              <ShoppingCart className="size-4" />
              <span>Keranjang</span>
              {cartCount > 0 ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-black shadow">
                  {cartCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section: Landing Page Visual Menarik */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/10 via-card/30 to-background py-14 sm:py-20 lg:py-24">
        {/* Ornamen Latar Belakang Halus */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-[700px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-1/2 -z-10 h-72 w-72 rounded-full bg-amber-500/10 blur-2xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            {/* Badge Highlight */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary sm:text-sm">
              <Sparkles className="size-4 text-primary" />
              <span>Belanja Cepat & Praktis Tanpa Perlu Daftar Akun</span>
            </div>

            {/* Headline Utama */}
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Pilihan Produk Terbaik,{" "}
              <span className="bg-gradient-to-r from-primary via-rose-500 to-amber-500 bg-clip-text text-transparent">
                Langsung ke Tangan Anda.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Pesan langsung dari katalog resmi{" "}
              <strong className="text-foreground">
                {settings.storeName || "kami"}
              </strong>
              . Pilih ambil di toko (Pickup) atau diantar kurir ke alamat Anda.
              Bayar aman di tempat (COD) atau QRIS instan!
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 font-semibold shadow-lg transition-transform hover:scale-105"
              >
                <a href="#katalog" className="inline-flex items-center gap-2">
                  <ShoppingBag className="size-4" />
                  Mulai Belanja Sekarang
                  <ArrowDown className="size-4" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full px-6 transition-colors hover:bg-muted"
              >
                <Link
                  href="/cek-pesanan"
                  className="inline-flex items-center gap-2"
                >
                  <PackageSearch className="size-4" />
                  Lacak Status Pesanan
                </Link>
              </Button>
            </div>

            {/* Trust Chips / Nilai Tambah */}
            <div className="mt-12 grid w-full grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <div className="flex flex-col items-center rounded-2xl border bg-card/60 p-4 text-center backdrop-blur-sm shadow-xs">
                <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <span className="text-sm font-semibold">Tanpa Login</span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  Langsung checkout instan
                </span>
              </div>

              <div className="flex flex-col items-center rounded-2xl border bg-card/60 p-4 text-center backdrop-blur-sm shadow-xs">
                <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <Truck className="size-5" />
                </div>
                <span className="text-sm font-semibold">Pickup / Antar</span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  Opsi ambil atau kurir
                </span>
              </div>

              <div className="flex flex-col items-center rounded-2xl border bg-card/60 p-4 text-center backdrop-blur-sm shadow-xs">
                <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
                  <ShieldCheck className="size-5" />
                </div>
                <span className="text-sm font-semibold">COD & QRIS</span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  Metode bayar aman
                </span>
              </div>

              <div className="flex flex-col items-center rounded-2xl border bg-card/60 p-4 text-center backdrop-blur-sm shadow-xs">
                <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                  <CheckCircle2 className="size-5" />
                </div>
                <span className="text-sm font-semibold">Stok Real-Time</span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  Sesuai persediaan toko
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Section Keunggulan Toko */}
      <section id="keunggulan" className="py-12 sm:py-16 border-b bg-card/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex gap-4 p-5 rounded-2xl border bg-card/70 backdrop-blur-sm shadow-xs hover:border-primary/40 transition-colors">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Store className="size-6" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-base">
                  Produk Terpilih & Terjamin
                </h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Semua barang berasal langsung dari gerai fisik kami dengan
                  kualitas yang senantiasa terjaga dan siap saji/ambil.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-5 rounded-2xl border bg-card/70 backdrop-blur-sm shadow-xs hover:border-primary/40 transition-colors">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Clock className="size-6" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-base">
                  Diproses Langsung Tanpa Antre
                </h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Begitu pesanan Anda masuk, staf toko kami segera menyiapkan
                  barang sehingga Anda tidak perlu menunggu lama.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-5 rounded-2xl border bg-card/70 backdrop-blur-sm shadow-xs hover:border-primary/40 transition-colors">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <MessageCircle className="size-6" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-base">
                  Bantuan Pelanggan Ramah
                </h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Ada kebutuhan khusus atau pertanyaan stok? Anda dapat
                  menghubungi WhatsApp staf kami kapan saja dengan cepat.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Section Katalog Produk */}
      <section id="katalog" className="py-12 sm:py-16 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header Katalog */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                <ShoppingBag className="size-3.5" />
                <span>Katalog Resmi</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                Jelajahi Produk Kami
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pilih produk yang Anda inginkan dan klik untuk melihat varian
                atau langsung masukkan ke keranjang.
              </p>
            </div>

            {/* Statistik Produk */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="px-2.5 py-1 text-xs">
                {visibleProducts.length} Produk Ditampilkan
              </Badge>
              {products.length !== visibleProducts.length ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategory(null);
                    setInStockOnly(false);
                    setSortBy("default");
                  }}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <RotateCcw className="size-3" />
                  Reset Filter
                </button>
              ) : null}
            </div>
          </div>

          {/* Filter Bar: Pencarian + Kategori + Urutan */}
          <div className="flex flex-col gap-4 mb-8 rounded-2xl border bg-card/60 p-4 sm:p-5 backdrop-blur-sm shadow-xs">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Input Cari */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari produk atau varian..."
                  aria-label="Cari produk"
                  className="pl-10 pr-9 min-h-11 rounded-xl bg-background"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    aria-label="Bersihkan pencarian"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      "default" | "price-asc" | "price-desc" | "name-asc"
                  )
                }
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Urutkan produk"
              >
                <option value="default">Urutan: Rekomendasi</option>
                <option value="price-asc">Harga: Terendah ke Tertinggi</option>
                <option value="price-desc">Harga: Tertinggi ke Terendah</option>
                <option value="name-asc">Nama: A ke Z</option>
              </select>

              {/* Toggle Hanya Stok Tersedia */}
              <button
                type="button"
                onClick={() => setInStockOnly((prev) => !prev)}
                className={`h-11 px-4 rounded-xl border text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                  inStockOnly
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-input bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${inStockOnly ? "bg-emerald-500" : "bg-muted-foreground"}`}
                />
                Hanya Stok Tersedia
              </button>
            </div>

            {/* Kategori Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-all shrink-0 ${
                  category === null
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border/80 bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                <span>Semua</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    category === null
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {products.length}
                </span>
              </button>

              {categories.map((name) => {
                const isSelected = category === name;
                const count = categoryCounts[name] ?? 0;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setCategory(name)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-all shrink-0 ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border/80 bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    }`}
                  >
                    <span>{name}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid Produk */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {visibleProducts.map((product) => {
              const prices = product.variants.map((v) => v.sellPrice);
              const cheapest = Math.min(...prices);
              const highest = Math.max(...prices);
              const soldOut = product.variants.every((v) => !v.isAvailable);
              const availableVariants = product.variants.filter(
                (v) => v.isAvailable
              );
              const hasMultipleVariants = product.variants.length > 1;

              return (
                <Card
                  key={product.productId}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl hover:border-primary/50 bg-card/70 backdrop-blur-sm ${
                    soldOut ? "opacity-60" : "cursor-pointer"
                  }`}
                  onClick={() => !soldOut && openProductDetail(product)}
                >
                  {/* Foto Produk */}
                  <div className="relative aspect-square w-full overflow-hidden bg-muted/60">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-muted/30 to-muted text-muted-foreground/50">
                        <ShoppingBag className="size-12 stroke-[1.25] text-primary/30" />
                        <span className="mt-2 text-xs font-medium text-muted-foreground/60">
                          {settings.storeName}
                        </span>
                      </div>
                    )}

                    {/* Badge Kategori */}
                    {product.categoryName ? (
                      <div className="absolute left-3 top-3">
                        <Badge
                          variant="secondary"
                          className="bg-background/85 backdrop-blur-md text-[11px] font-medium shadow-xs"
                        >
                          {product.categoryName}
                        </Badge>
                      </div>
                    ) : null}

                    {/* Status Ketersediaan */}
                    <div className="absolute right-3 top-3">
                      {soldOut ? (
                        <span className="inline-flex items-center rounded-full bg-rose-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-xs">
                          Habis
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-xs">
                          <span className="size-1.5 rounded-full bg-white animate-pulse" />
                          Tersedia
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Konten Card */}
                  <CardContent className="flex flex-1 flex-col p-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 text-base leading-snug">
                        {product.name}
                      </h3>

                      {product.description ? (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {hasMultipleVariants
                          ? `${product.variants.length} pilihan varian`
                          : "1 varian"}
                      </span>
                      {hasMultipleVariants && availableVariants.length > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {availableVariants.length} siap dipesan
                        </span>
                      ) : null}
                    </div>

                    {/* Harga & Tombol Aksi */}
                    <div className="mt-3 flex items-end justify-between border-t pt-3">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">
                          {hasMultipleVariants && cheapest !== highest
                            ? "Mulai dari"
                            : "Harga"}
                        </span>
                        <span className="text-base font-bold text-foreground">
                          {formatRupiah(cheapest)}
                        </span>
                      </div>

                      {soldOut ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled
                          className="h-9 px-3 rounded-xl text-xs opacity-75"
                        >
                          Habis
                        </Button>
                      ) : hasMultipleVariants ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleQuickAdd(e, product)}
                          className="h-9 px-3 rounded-xl text-xs gap-1 group-hover:border-primary group-hover:bg-primary/5 transition-all"
                        >
                          <span>Pilih</span>
                          <ChevronRight className="size-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={(e) => handleQuickAdd(e, product)}
                          className="h-9 px-3.5 rounded-xl text-xs gap-1 font-semibold shadow-xs"
                        >
                          <Plus className="size-3.5" />
                          <span>Pesan</span>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Empty State */}
          {visibleProducts.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                <Search className="size-6" />
              </div>
              <h3 className="font-semibold text-foreground text-lg">
                Tidak ada produk ditemukan
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Coba sesuaikan kata kunci pencarian atau pilih kategori yang
                lain.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-xl"
                onClick={() => {
                  setQuery("");
                  setCategory(null);
                  setInStockOnly(false);
                }}
              >
                Tampilkan Semua Produk
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {/* 5. Section "3 Langkah Mudah Belanja" */}
      <section id="cara-belanja" className="py-14 sm:py-20 border-t bg-card/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Mudah & Tanpa Ribet
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Cara Belanja di {settings.storeName || "Toko Kami"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tiga langkah mudah untuk memesan produk favorit Anda secara online
              tanpa registrasi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative flex flex-col items-center text-center p-6 rounded-2xl border bg-card/60 shadow-xs">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-extrabold text-xl shadow-md">
                1
              </div>
              <h3 className="font-semibold text-lg">Pilih Produk & Varian</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Pilih barang yang Anda inginkan dari katalog, tentukan varian
                serta jumlahnya, lalu masukkan ke keranjang belanja.
              </p>
            </div>

            <div className="relative flex flex-col items-center text-center p-6 rounded-2xl border bg-card/60 shadow-xs">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-extrabold text-xl shadow-md">
                2
              </div>
              <h3 className="font-semibold text-lg">Isi Data Pemesanan</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Masukkan nama dan nomor WhatsApp Anda. Pilih metode penerimaan:
                ambil sendiri di gerai kami atau kurir antar ke alamat.
              </p>
            </div>

            <div className="relative flex flex-col items-center text-center p-6 rounded-2xl border bg-card/60 shadow-xs">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-extrabold text-xl shadow-md">
                3
              </div>
              <h3 className="font-semibold text-lg">Selesai & Lacak Pesanan</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Pesanan langsung masuk ke antrean toko kami. Anda dapat mengecek
                status pemrosesan secara real-time kapan saja.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Section Info Toko & Kontak */}
      <section id="kontak" className="py-14 sm:py-20 border-t bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border bg-gradient-to-br from-card/80 to-card/40 p-8 sm:p-12 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-medium text-primary mb-3">
                  <Store className="size-3.5" />
                  <span>Tentang Toko Kami</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                  {settings.storeName || "Toko DNAE"}
                </h2>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  Kami berdedikasi menyediakan produk berkualitas tinggi dengan
                  pelayanan yang ramah, cepat, dan terpercaya. Pesan kebutuhan
                  Anda hari ini dan rasakan kemudahannya.
                </p>

                <div className="mt-6 flex flex-col gap-3 text-sm">
                  <div className="flex items-start gap-3 text-foreground">
                    <MapPin className="size-5 shrink-0 text-primary mt-0.5" />
                    <span>
                      {settings.storeAddress || "Alamat toko fisik tersedia"}
                    </span>
                  </div>

                  {settings.storePhone ? (
                    <div className="flex items-center gap-3 text-foreground">
                      <Phone className="size-5 shrink-0 text-primary" />
                      <span>{settings.storePhone}</span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {waLink ? (
                    <Button
                      asChild
                      className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
                    >
                      <a href={waLink} target="_blank" rel="noreferrer">
                        <MessageCircle className="size-4" />
                        Chat via WhatsApp
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full hover:bg-muted"
                  >
                    <Link href="/cek-pesanan">
                      <PackageSearch className="size-4" />
                      Cek Pesanan Saya
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Box Info Tambahan */}
              <div className="rounded-2xl border bg-background/80 p-6 sm:p-8 backdrop-blur-sm shadow-xs flex flex-col gap-4">
                <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                  <ShieldCheck className="size-5 text-emerald-500" />
                  Jaminan Belanja Aman & Nyaman
                </h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">
                        Tanpa biaya tersembunyi
                      </strong>{" "}
                      — Harga yang tertera adalah harga resmi sesuai toko.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">
                        Pilihan pembayaran fleksibel
                      </strong>{" "}
                      — Bayar tunai (COD) saat barang sampai atau QRIS cepat.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">
                        Notifikasi & lacak langsung
                      </strong>{" "}
                      — Simpan nomor pesanan dan pantau proses pengerjaan.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Bar Keranjang Melayang (Sticky Bottom Bar) */}
      {cartCount > 0 ? (
        <div className="fixed bottom-5 inset-x-4 z-40 mx-auto max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-background/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 pl-1">
              <div className="relative flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <ShoppingBag className="size-5" />
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
                  {cartCount}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  Total Keranjang ({cartCount} item)
                </span>
                <span className="text-base font-bold text-foreground">
                  {formatRupiah(cartTotal)}
                </span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setCartOpen(true)}
              className="h-10 rounded-xl px-5 font-semibold shadow-md gap-2"
            >
              <span>Lihat Keranjang</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* 8. Dialog Detail & Pilih Varian Produk */}
      <Dialog
        open={activeProduct !== null}
        onOpenChange={(o) => {
          if (!o) {
            setActiveProduct(null);
            setSelectedVariant(null);
            setModalQty(1);
          }
        }}
      >
        <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden rounded-2xl">
          {activeProduct ? (
            <div>
              {/* Gambar / Banner Modal */}
              <div className="relative aspect-video w-full bg-muted overflow-hidden">
                {activeProduct.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeProduct.imageUrl}
                    alt={activeProduct.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-muted">
                    <ShoppingBag className="size-16 text-primary/30" />
                  </div>
                )}
                {activeProduct.categoryName ? (
                  <Badge className="absolute left-4 top-4 bg-background/90 text-foreground backdrop-blur-md">
                    {activeProduct.categoryName}
                  </Badge>
                ) : null}
              </div>

              <div className="p-6">
                <DialogHeader className="p-0 text-left">
                  <DialogTitle className="text-xl font-bold">
                    {activeProduct.name}
                  </DialogTitle>
                </DialogHeader>

                {activeProduct.description ? (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {activeProduct.description}
                  </p>
                ) : null}

                {/* Pemilihan Varian */}
                <div className="mt-5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                    Pilih Varian
                  </label>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {activeProduct.variants.map((v) => {
                      const isChosen = selectedVariant?.id === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={!v.isAvailable}
                          onClick={() => setSelectedVariant(v)}
                          className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                            isChosen
                              ? "border-primary bg-primary/10 shadow-xs"
                              : "border-border hover:border-foreground/30 hover:bg-muted/50"
                          } ${!v.isAvailable ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`size-4 rounded-full border flex items-center justify-center ${
                                isChosen
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/40"
                              }`}
                            >
                              {isChosen ? (
                                <Check className="size-2.5 stroke-[3]" />
                              ) : null}
                            </div>
                            <span className="font-medium text-sm">
                              {v.name}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-sm font-bold block">
                              {formatRupiah(v.sellPrice)}
                            </span>
                            {!v.isAvailable ? (
                              <span className="text-[10px] text-rose-500 font-medium">
                                Stok Habis
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stepper Jumlah */}
                {selectedVariant && selectedVariant.isAvailable ? (
                  <div className="mt-5 flex items-center justify-between border-t pt-4">
                    <span className="text-sm font-medium">Jumlah Pesanan</span>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 rounded-lg"
                        disabled={modalQty <= 1}
                        onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                        aria-label="Kurangi jumlah"
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-8 text-center font-bold text-sm">
                        {modalQty}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 rounded-lg"
                        disabled={modalQty >= MAX_QTY}
                        onClick={() =>
                          setModalQty((q) => Math.min(MAX_QTY, q + 1))
                        }
                        aria-label="Tambah jumlah"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : null}

                {/* Tombol Tambahkan */}
                <div className="mt-6 flex gap-3">
                  <Button
                    className="w-full h-12 rounded-xl font-semibold shadow-md gap-2"
                    disabled={!selectedVariant || !selectedVariant.isAvailable}
                    onClick={() => {
                      if (selectedVariant && selectedVariant.isAvailable) {
                        addToCart(activeProduct, selectedVariant, modalQty);
                      }
                    }}
                  >
                    <ShoppingCart className="size-4" />
                    <span>
                      {selectedVariant && selectedVariant.isAvailable
                        ? `Tambah ke Keranjang • ${formatRupiah(
                            selectedVariant.sellPrice * modalQty
                          )}`
                        : "Pilih Varian yang Tersedia"}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 9. Dialog Keranjang Belanja */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <ShoppingCart className="size-5 text-primary" />
              <span>Keranjang Belanja ({cartCount})</span>
            </DialogTitle>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground/60 mb-3">
                <ShoppingBag className="size-8" />
              </div>
              <p className="font-semibold text-foreground">Keranjang kosong</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Belum ada produk yang ditambahkan. Silakan pilih produk dari
                katalog untuk mulai berbelanja.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-xl"
                onClick={() => setCartOpen(false)}
              >
                Mulai Belanja
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Daftar Item Keranjang */}
              <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
                {cart.map((line) => (
                  <div
                    key={line.variantId}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-card/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {line.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {line.variantName} · {formatRupiah(line.price)}
                      </p>
                      <p className="text-xs font-bold text-primary mt-0.5">
                        {formatRupiah(line.price * line.qty)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-lg"
                        onClick={() => setQty(line.variantId, line.qty - 1)}
                        aria-label={`Kurangi ${line.variantName}`}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-6 text-center text-xs font-bold">
                        {line.qty}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-lg"
                        onClick={() => setQty(line.variantId, line.qty + 1)}
                        aria-label={`Tambah ${line.variantName}`}
                      >
                        <Plus className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg text-muted-foreground hover:text-rose-500"
                        onClick={() => removeFromCart(line.variantId)}
                        aria-label={`Hapus ${line.variantName}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rincian Total */}
              <div className="border-t pt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Item</span>
                  <span className="font-medium">{cartCount} barang</span>
                </div>
                <div className="flex items-center justify-between text-base font-bold">
                  <span>Subtotal Belanja</span>
                  <span className="text-primary">
                    {formatRupiah(cartTotal)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  * Biaya pengantaran (bila memilih kurir) dapat dikonfirmasi
                  langsung dengan toko saat pesanan diproses.
                </p>
              </div>

              {/* Tombol Lanjut Checkout */}
              <Button
                className="min-h-12 w-full rounded-xl font-semibold shadow-md gap-2"
                onClick={() => {
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
              >
                <span>Lanjut ke Data Pemesanan</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 10. Dialog Checkout Data Diri */}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        cart={cart}
        total={cartTotal}
        onOrdered={handleOrdered}
      />

      {/* 11. Footer Halaman Publik */}
      <footer className="mt-auto border-t bg-card/40 py-10 text-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Kolom 1: Profil Toko */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                {settings.storeLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.storeLogoUrl}
                    alt={settings.storeName}
                    className="size-8 rounded-lg object-cover"
                  />
                ) : (
                  <Store className="size-5 text-primary" />
                )}
                <span className="font-bold text-base text-foreground">
                  {settings.storeName || "DNAE"}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground max-w-sm leading-relaxed">
                Platform belanja langsung dari toko fisik terpercaya. Pesan
                kebutuhan harian Anda lebih praktis, cepat, dan terjamin tanpa
                antre.
              </p>
              <div className="mt-4 flex flex-col gap-1 text-xs text-muted-foreground">
                <span>{settings.storeAddress}</span>
                {settings.storePhone ? (
                  <span>{settings.storePhone}</span>
                ) : null}
              </div>
            </div>

            {/* Kolom 2: Tautan Pintas */}
            <div>
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">
                Navigasi Cepat
              </h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <a href="#katalog" className="hover:text-foreground">
                    Katalog Produk
                  </a>
                </li>
                <li>
                  <a href="#keunggulan" className="hover:text-foreground">
                    Keunggulan Kami
                  </a>
                </li>
                <li>
                  <a href="#cara-belanja" className="hover:text-foreground">
                    Cara Pemesanan
                  </a>
                </li>
                <li>
                  <Link href="/cek-pesanan" className="hover:text-foreground">
                    Lacak Status Pesanan
                  </Link>
                </li>
              </ul>
            </div>

            {/* Kolom 3: Layanan & Keamanan */}
            <div>
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">
                Layanan Pelanggan
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Punya pertanyaan mengenai stok atau pesanan?
              </p>
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <MessageCircle className="size-4" />
                  Chat WhatsApp Kami
                </a>
              ) : null}
              <div className="mt-4 flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-4 text-emerald-500" />
                <span>Transaksi Langsung & Terverifikasi</span>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>
              © {new Date().getFullYear()} {settings.storeName || "DNAE"}. Semua
              hak dilindungi.
            </p>
            <p>Belanja Online Cepat Tanpa Akun</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

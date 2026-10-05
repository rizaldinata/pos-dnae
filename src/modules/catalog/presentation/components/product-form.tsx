"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from "@/modules/catalog/presentation/actions/product.action";
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

export interface VariantFormRow {
  key: string;
  id?: string;
  sku: string;
  barcode: string;
  variantName: string;
  costPrice: string;
  sellPrice: string;
  minStock: string;
  trackStock: boolean;
}

export interface ProductFormInitial {
  id?: string;
  name: string;
  categoryId: string;
  brandId: string;
  unitId: string;
  description: string;
  isActive: boolean;
  variants: Omit<VariantFormRow, "key">[];
}

export interface MasterOption {
  id: string;
  name: string;
  shortName?: string;
}

const initialState: ProductActionState = { success: false, message: null };

function newVariantRow(): VariantFormRow {
  return {
    key: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sku: "",
    barcode: "",
    variantName: "",
    costPrice: "",
    sellPrice: "",
    minStock: "",
    trackStock: true,
  };
}

const inputClass = "min-h-11";
const labelClass = "text-sm font-medium";

export function ProductForm({
  mode,
  initial,
  categories,
  brands,
  units,
}: {
  mode: "create" | "edit";
  initial?: ProductFormInitial;
  categories: MasterOption[];
  brands: MasterOption[];
  units: MasterOption[];
}) {
  const router = useRouter();
  const [state, setState] = useState<ProductActionState>(initialState);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [brandId, setBrandId] = useState(initial?.brandId ?? "");
  const [unitId, setUnitId] = useState(initial?.unitId ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [variants, setVariants] = useState<VariantFormRow[]>(
    initial?.variants.map((v, i) => ({ ...v, key: v.id ?? `init-${i}` })) ?? [
      newVariantRow(),
    ]
  );

  function updateVariant(key: string, patch: Partial<VariantFormRow>) {
    setVariants((prev) =>
      prev.map((v) => (v.key === key ? { ...v, ...patch } : v))
    );
  }

  function removeVariant(key: string) {
    setVariants((prev) =>
      prev.length > 1 ? prev.filter((v) => v.key !== key) : prev
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    if (mode === "edit" && initial?.id) {
      formData.set("productId", initial.id);
    }
    formData.set("name", name);
    formData.set("categoryId", categoryId);
    formData.set("brandId", brandId);
    formData.set("unitId", unitId);
    formData.set("description", description);
    if (isActive) {
      formData.set("isActive", "on");
    }
    formData.set(
      "variants",
      JSON.stringify(
        variants.map((v) => ({
          id: v.id || undefined,
          sku: v.sku,
          barcode: v.barcode || null,
          variantName: v.variantName,
          costPrice: Number(v.costPrice) || 0,
          sellPrice: Number(v.sellPrice) || 0,
          minStock: Number(v.minStock) || 0,
          trackStock: v.trackStock,
        }))
      )
    );

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createProductAction(initialState, formData)
          : await updateProductAction(initialState, formData);
      setState(result);
      if (
        result.success &&
        mode === "create" &&
        "productId" in result &&
        result.productId
      ) {
        router.push(`/produk/${result.productId}`);
      }
    });
  }

  const selectClass =
    "flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Info produk</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="product-name" className={labelClass}>
                Nama produk
              </label>
              <Input
                id="product-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={pending}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-category" className={labelClass}>
                Kategori
              </label>
              <select
                id="product-category"
                className={selectClass}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={pending}
              >
                <option value="">Tanpa kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-brand" className={labelClass}>
                Brand
              </label>
              <select
                id="product-brand"
                className={selectClass}
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                disabled={pending}
              >
                <option value="">Tanpa brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-unit" className={labelClass}>
                Satuan
              </label>
              <select
                id="product-unit"
                className={selectClass}
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                disabled={pending}
              >
                <option value="">Tanpa satuan</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.shortName ? ` (${u.shortName})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="product-description" className={labelClass}>
              Deskripsi
            </label>
            <textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={pending}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={pending}
              className="size-4"
            />
            Produk aktif (tampil di kasir)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Varian ({variants.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Nama varian</TableHead>
                  <TableHead className="text-right">Hrg modal</TableHead>
                  <TableHead className="text-right">Hrg jual</TableHead>
                  <TableHead className="text-right">Min stok</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((v) => (
                  <TableRow key={v.key}>
                    <TableCell>
                      <Input
                        value={v.sku}
                        onChange={(e) =>
                          updateVariant(v.key, {
                            sku: e.target.value.toUpperCase(),
                          })
                        }
                        required
                        disabled={pending}
                        className="min-w-28 font-mono"
                        aria-label="SKU varian"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={v.barcode}
                        onChange={(e) =>
                          updateVariant(v.key, { barcode: e.target.value })
                        }
                        disabled={pending}
                        className="min-w-28 font-mono"
                        aria-label="Barcode varian"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={v.variantName}
                        onChange={(e) =>
                          updateVariant(v.key, { variantName: e.target.value })
                        }
                        disabled={pending}
                        className="min-w-24"
                        aria-label="Nama varian"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={v.costPrice}
                        onChange={(e) =>
                          updateVariant(v.key, { costPrice: e.target.value })
                        }
                        required
                        disabled={pending}
                        className="min-w-24 text-right"
                        aria-label="Harga modal"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={v.sellPrice}
                        onChange={(e) =>
                          updateVariant(v.key, { sellPrice: e.target.value })
                        }
                        required
                        disabled={pending}
                        className="min-w-24 text-right"
                        aria-label="Harga jual"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={v.minStock}
                        onChange={(e) =>
                          updateVariant(v.key, { minStock: e.target.value })
                        }
                        disabled={pending}
                        className="w-20 text-right"
                        aria-label="Stok minimum"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending || variants.length <= 1}
                        onClick={() => removeVariant(v.key)}
                      >
                        Hapus
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setVariants((prev) => [...prev, newVariantRow()])}
              disabled={pending}
            >
              Tambah varian
            </Button>
          </div>
        </CardContent>
      </Card>

      {state.message && (
        <p
          role="alert"
          className={`text-sm ${state.success ? "text-green-600" : "text-destructive"}`}
        >
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending
            ? "Menyimpan..."
            : mode === "create"
              ? "Buat produk"
              : "Simpan perubahan"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          className="min-h-11"
          onClick={() =>
            mode === "create"
              ? router.push("/produk")
              : router.push(`/produk/${initial?.id}`)
          }
        >
          Batal
        </Button>
      </div>
    </form>
  );
}

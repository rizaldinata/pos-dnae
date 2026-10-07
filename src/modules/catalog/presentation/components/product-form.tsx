"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from "@/modules/catalog/presentation/actions/product.action";
import { setPriceTiersAction } from "@/modules/catalog/presentation/actions/price-tier.action";
import { uploadProductImageAction } from "@/modules/catalog/presentation/actions/photo.action";
import imageCompression from "browser-image-compression";
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
import { generateEan13 } from "@/modules/catalog/domain/services/barcode";

export interface VariantTierRow {
  minQty: string;
  price: string;
}

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
  /** URL foto tersimpan (null = belum ada). */
  imageUrl: string | null;
  /** File foto baru yang menunggu diunggah saat submit. */
  photoFile: File | null;
  /** Preview tampilan: objectURL foto baru, atau imageUrl tersimpan. */
  photoPreview: string;
  tiers: VariantTierRow[];
}

export interface ProductFormInitial {
  id?: string;
  name: string;
  categoryId: string;
  brandId: string;
  unitId: string;
  description: string;
  imageUrl?: string | null;
  isActive: boolean;
  isBundle?: boolean;
  variants: (Omit<
    VariantFormRow,
    "key" | "tiers" | "photoFile" | "photoPreview"
  > & {
    tiers: { minQty: number; price: number }[];
  })[];
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
    imageUrl: null,
    photoFile: null,
    photoPreview: "",
    tiers: [],
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
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(initial?.imageUrl ?? "");
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isBundle, setIsBundle] = useState(initial?.isBundle ?? false);
  const [variants, setVariants] = useState<VariantFormRow[]>(
    initial?.variants.map((v, i) => ({
      ...v,
      key: v.id ?? `init-${i}`,
      photoFile: null,
      photoPreview: v.imageUrl ?? "",
      tiers: v.tiers.map((t) => ({
        minQty: String(t.minQty),
        price: String(t.price),
      })),
    })) ?? [newVariantRow()]
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

  function updateTier(
    key: string,
    index: number,
    patch: Partial<VariantTierRow>
  ) {
    setVariants((prev) =>
      prev.map((v) =>
        v.key === key
          ? {
              ...v,
              tiers: v.tiers.map((t, i) =>
                i === index ? { ...t, ...patch } : t
              ),
            }
          : v
      )
    );
  }

  function addTier(key: string) {
    setVariants((prev) =>
      prev.map((v) =>
        v.key === key
          ? { ...v, tiers: [...v.tiers, { minQty: "", price: "" }] }
          : v
      )
    );
  }

  function removeTier(key: string, index: number) {
    setVariants((prev) =>
      prev.map((v) =>
        v.key === key
          ? { ...v, tiers: v.tiers.filter((_, i) => i !== index) }
          : v
      )
    );
  }

  const [expandedTiers, setExpandedTiers] = useState<string | null>(null);

  async function persistTiers(
    savedVariants: { id: string; sku: string }[] | undefined,
    formVariants: VariantFormRow[]
  ): Promise<string | null> {
    const bySku = new Map(
      savedVariants?.map((v) => [v.sku.toUpperCase(), v.id])
    );
    for (const v of formVariants) {
      const variantId = v.id || bySku.get(v.sku.toUpperCase());
      if (!variantId) {
        continue;
      }
      const tiers = v.tiers
        .filter((t) => t.minQty !== "" && t.price !== "")
        .map((t) => ({
          minQty: Math.floor(Number(t.minQty) || 0),
          price: Math.round(Number(t.price) || 0),
        }))
        .filter((t) => t.minQty > 0 && t.price >= 0);
      const result = await setPriceTiersAction(variantId, tiers);
      if (!result.success) {
        return result.message;
      }
    }
    return null;
  }

  async function handlePhotoSelect(file: File | undefined) {
    setPhotoMessage(null);
    if (!file) {
      setPhotoFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoMessage("File harus berupa gambar");
      return;
    }
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      });
      setPhotoFile(
        new File([compressed], file.name, {
          type: compressed.type || file.type,
        })
      );
      setPhotoPreview(URL.createObjectURL(compressed));
    } catch {
      setPhotoMessage("Gagal mengompres gambar");
    }
  }

  async function handleVariantPhotoSelect(key: string, file?: File) {
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setState({ success: false, message: "File foto varian harus gambar" });
      return;
    }
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      });
      updateVariant(key, {
        photoFile: new File([compressed], file.name, {
          type: compressed.type || file.type,
        }),
        photoPreview: URL.createObjectURL(compressed),
      });
    } catch {
      setState({ success: false, message: "Gagal mengompres foto varian" });
    }
  }

  function clearVariantPhoto(key: string) {
    updateVariant(key, { imageUrl: null, photoFile: null, photoPreview: "" });
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
    formData.set("imageUrl", imageUrl);
    if (isActive) {
      formData.set("isActive", "on");
    }
    if (isBundle) {
      formData.set("isBundle", "on");
    }

    startTransition(async () => {
      if (photoFile) {
        const uploadData = new FormData();
        uploadData.set("photo", photoFile);
        const uploaded = await uploadProductImageAction(uploadData);
        if (!uploaded.success || !uploaded.url) {
          setState({
            success: false,
            message: uploaded.message ?? "Upload foto gagal",
          });
          return;
        }
        formData.set("imageUrl", uploaded.url);
        setImageUrl(uploaded.url);
      }
      // Unggah foto varian yang baru dipilih, lalu susun payload varian
      // dengan URL final (foto baru menimpa foto tersimpan).
      const uploadedVariantUrls = new Map<string, string>();
      for (const v of variants) {
        if (!v.photoFile) {
          continue;
        }
        const uploadData = new FormData();
        uploadData.set("photo", v.photoFile);
        const uploaded = await uploadProductImageAction(uploadData);
        if (!uploaded.success || !uploaded.url) {
          setState({
            success: false,
            message: `Foto varian ${v.variantName || v.sku || "tanpa nama"} gagal diunggah: ${uploaded.message ?? "upload gagal"}`,
          });
          return;
        }
        uploadedVariantUrls.set(v.key, uploaded.url);
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
            imageUrl: uploadedVariantUrls.get(v.key) ?? v.imageUrl ?? null,
          }))
        )
      );
      const result =
        mode === "create"
          ? await createProductAction(initialState, formData)
          : await updateProductAction(initialState, formData);
      if (!result.success) {
        setState(result);
        return;
      }
      const tierError = await persistTiers(result.variants, variants);
      if (tierError) {
        setState({
          success: false,
          message: `Produk tersimpan, tetapi harga grosir gagal: ${tierError}`,
        });
        return;
      }
      setState(result);
      if (mode === "create" && result.productId) {
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
            <span className={labelClass}>Foto produk</span>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt="Foto produk"
                  className="h-20 w-20 rounded-md border object-cover"
                />
              ) : (
                <span className="text-xs text-muted-foreground">
                  Belum ada foto
                </span>
              )}
              <Input
                id="product-photo"
                type="file"
                accept="image/*"
                disabled={pending}
                onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
                className="max-w-xs"
              />
            </div>
            {photoMessage && (
              <p className="text-xs text-muted-foreground">{photoMessage}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Dikompres otomatis (maks 1MB) sebelum diunggah.
            </p>
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
          <div className="flex flex-col gap-1">
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={isBundle}
                onChange={(e) => setIsBundle(e.target.checked)}
                disabled={pending}
                className="size-4"
              />
              Bundle / paket (stok mengikuti komponen)
            </label>
            {isBundle && (
              <p className="text-xs text-muted-foreground">
                Saat bundle terjual, stok komponen yang berkurang — bukan stok
                bundle. Komponen dapat diisi setelah produk tersimpan.
              </p>
            )}
          </div>
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
                  <TableHead>Foto</TableHead>
                  <TableHead className="text-right">Hrg modal</TableHead>
                  <TableHead className="text-right">Hrg jual</TableHead>
                  <TableHead className="text-right">Min stok</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((v) => (
                  <Fragment key={v.key}>
                    <TableRow>
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
                        <div className="flex flex-col gap-1">
                          <Input
                            value={v.barcode}
                            onChange={(e) =>
                              updateVariant(v.key, { barcode: e.target.value })
                            }
                            disabled={pending}
                            className="min-w-28 font-mono"
                            aria-label="Barcode varian"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={pending}
                            onClick={() =>
                              updateVariant(v.key, { barcode: generateEan13() })
                            }
                          >
                            Generate EAN-13
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={v.variantName}
                          onChange={(e) =>
                            updateVariant(v.key, {
                              variantName: e.target.value,
                            })
                          }
                          disabled={pending}
                          className="min-w-24"
                          aria-label="Nama varian"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {v.photoPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={v.photoPreview}
                              alt={`Foto ${v.variantName || v.sku}`}
                              className="h-9 w-9 shrink-0 rounded-md border object-cover"
                            />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-[10px] text-muted-foreground">
                              Foto
                            </span>
                          )}
                          <div className="flex flex-col items-start gap-0.5">
                            <label className="cursor-pointer text-xs text-primary hover:underline">
                              {v.photoFile || v.imageUrl ? "Ganti" : "Pilih"}
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={pending}
                                onChange={(e) => {
                                  void handleVariantPhotoSelect(
                                    v.key,
                                    e.target.files?.[0]
                                  );
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {(v.photoFile || v.imageUrl) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 text-xs"
                                disabled={pending}
                                onClick={() => clearVariantPhoto(v.key)}
                              >
                                Hapus
                              </Button>
                            )}
                          </div>
                        </div>
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
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant={v.tiers.length > 0 ? "secondary" : "ghost"}
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              setExpandedTiers((prev) =>
                                prev === v.key ? null : v.key
                              )
                            }
                            aria-label={`Harga grosir ${v.sku || "varian"}`}
                          >
                            Grosir
                            {v.tiers.length > 0 ? ` (${v.tiers.length})` : ""}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending || variants.length <= 1}
                            onClick={() => removeVariant(v.key)}
                          >
                            Hapus
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedTiers === v.key && (
                      <TableRow key={`${v.key}-tiers`}>
                        <TableCell colSpan={8}>
                          <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-2">
                            <p className="text-xs font-medium">
                              Harga grosir — berlaku otomatis saat qty mencapai
                              batas (harga reguler {v.sellPrice || 0})
                            </p>
                            {v.tiers.map((t, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-xs">≥</span>
                                <Input
                                  type="number"
                                  min={1}
                                  value={t.minQty}
                                  onChange={(e) =>
                                    updateTier(v.key, i, {
                                      minQty: e.target.value,
                                    })
                                  }
                                  disabled={pending}
                                  aria-label="Qty minimum grosir"
                                  className="h-9 w-24 text-right"
                                  placeholder="Qty"
                                />
                                <span className="text-xs">Rp</span>
                                <Input
                                  type="number"
                                  min={0}
                                  value={t.price}
                                  onChange={(e) =>
                                    updateTier(v.key, i, {
                                      price: e.target.value,
                                    })
                                  }
                                  disabled={pending}
                                  aria-label="Harga grosir"
                                  className="h-9 w-32 text-right"
                                  placeholder="Harga"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={pending}
                                  onClick={() => removeTier(v.key, i)}
                                >
                                  Hapus
                                </Button>
                              </div>
                            ))}
                            <div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={pending || v.tiers.length >= 10}
                                onClick={() => addTier(v.key)}
                              >
                                Tambah tier
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
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

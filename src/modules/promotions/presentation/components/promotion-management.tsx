"use client";

import { useState, useTransition } from "react";
import {
  createPromotionAction,
  togglePromotionAction,
  updatePromotionAction,
  type PromotionActionState,
  type PromotionDTO,
} from "@/modules/promotions/presentation/actions/promotion.action";
import { searchProductsPOSAction } from "@/modules/sales/presentation/actions/pos-search.action";
import { PromotionEngine } from "@/modules/promotions/domain/services/promotion-engine";
import { Money } from "@/shared/lib/money";
import { formatDateJakarta } from "@/shared/lib/date";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

export interface ScopeOption {
  id: string;
  name: string;
}

const initialState: PromotionActionState = { success: false, message: null };
const inputClass = "min-h-11";
const selectClass =
  "min-h-11 rounded-md border border-input bg-transparent px-3 text-sm";

const SCOPE_LABELS: Record<PromotionDTO["scope"], string> = {
  all: "Semua produk",
  category: "Kategori",
  product: "Produk",
};

function describe(promo: PromotionDTO): string {
  return PromotionEngine.describe({
    type: promo.type,
    value: Money.create(promo.value),
    buyQty: promo.buyQty,
    getQty: promo.getQty,
  });
}

function statusOf(promo: PromotionDTO): { label: string; className: string } {
  if (!promo.isActive) {
    return { label: "Nonaktif", className: "bg-muted text-muted-foreground" };
  }
  const now = Date.now();
  if (now < new Date(promo.startAt).getTime()) {
    return { label: "Terjadwal", className: "bg-blue-100 text-blue-700" };
  }
  if (now > new Date(promo.endAt).getTime()) {
    return { label: "Selesai", className: "bg-muted text-muted-foreground" };
  }
  return { label: "Aktif", className: "bg-green-100 text-green-700" };
}

function ScopeRefField({
  scope,
  categories,
  defaultId,
  defaultName,
  disabled,
}: {
  scope: PromotionDTO["scope"];
  categories: ScopeOption[];
  defaultId: string;
  defaultName: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScopeOption[]>([]);
  const [selected, setSelected] = useState<ScopeOption | null>(
    defaultId ? { id: defaultId, name: defaultName } : null
  );
  const [pending, startTransition] = useTransition();

  if (scope === "all") {
    return <input type="hidden" name="scopeRefId" value="" />;
  }

  if (scope === "category") {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor="promo-scope-ref" className="text-sm font-medium">
          Kategori
        </label>
        <select
          id="promo-scope-ref"
          name="scopeRefId"
          defaultValue={defaultId}
          required
          disabled={disabled}
          className={selectClass}
        >
          <option value="">Pilih kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function search(next: string) {
    setQuery(next);
    if (!next.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const products = await searchProductsPOSAction(next.trim(), 10);
      setResults(products.map((p) => ({ id: p.productId, name: p.name })));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="promo-scope-product" className="text-sm font-medium">
        Produk
      </label>
      <Input
        id="promo-scope-product"
        value={selected && !query ? selected.name || selected.id : query}
        onChange={(e) => {
          setSelected(null);
          search(e.target.value);
        }}
        placeholder="Cari nama produk..."
        disabled={disabled}
        className={inputClass}
        autoComplete="off"
      />
      <input type="hidden" name="scopeRefId" value={selected?.id ?? ""} />
      {selected && (
        <p className="text-xs text-muted-foreground">
          Produk terpilih: {selected.name || selected.id}
        </p>
      )}
      {results.length > 0 && !selected && (
        <ul className="max-h-40 overflow-y-auto rounded-md border">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setSelected(r);
                  setQuery("");
                  setResults([]);
                }}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {pending && <p className="text-xs text-muted-foreground">Mencari...</p>}
    </div>
  );
}

function PromotionFields({
  promotion,
  categories,
  scopeNames,
  disabled,
}: {
  promotion?: PromotionDTO;
  categories: ScopeOption[];
  scopeNames: Record<string, string>;
  disabled?: boolean;
}) {
  const scope = promotion?.scope ?? "all";
  const type = promotion?.type ?? "percent";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="flex flex-col gap-2">
        <label htmlFor="promo-name" className="text-sm font-medium">
          Nama promo
        </label>
        <Input
          id="promo-name"
          name="name"
          defaultValue={promotion?.name ?? ""}
          required
          disabled={disabled}
          className={inputClass}
          placeholder="Mis. Diskon Akhir Pekan"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="promo-type" className="text-sm font-medium">
            Tipe
          </label>
          <select
            id="promo-type"
            name="type"
            defaultValue={type}
            disabled={disabled || Boolean(promotion)}
            className={selectClass}
          >
            <option value="percent">Diskon persen</option>
            <option value="amount">Diskon nominal</option>
            <option value="bogo">Beli gratis (BOGO)</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="promo-scope" className="text-sm font-medium">
            Berlaku untuk
          </label>
          <select
            id="promo-scope"
            name="scope"
            defaultValue={scope}
            disabled={disabled || Boolean(promotion)}
            className={selectClass}
          >
            <option value="all">Semua produk</option>
            <option value="category">Kategori tertentu</option>
            <option value="product">Produk tertentu</option>
          </select>
        </div>
      </div>

      {type !== "bogo" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="promo-value" className="text-sm font-medium">
            {type === "percent" ? "Diskon (%)" : "Diskon (Rp)"}
          </label>
          <Input
            id="promo-value"
            name="value"
            type="number"
            min={0}
            max={type === "percent" ? 100 : undefined}
            defaultValue={promotion?.value ?? ""}
            required
            disabled={disabled}
            className={inputClass}
          />
        </div>
      )}

      {type === "bogo" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="promo-buy-qty" className="text-sm font-medium">
              Beli (qty)
            </label>
            <Input
              id="promo-buy-qty"
              name="buyQty"
              type="number"
              min={1}
              defaultValue={promotion?.buyQty || 1}
              required
              disabled={disabled}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="promo-get-qty" className="text-sm font-medium">
              Gratis (qty)
            </label>
            <Input
              id="promo-get-qty"
              name="getQty"
              type="number"
              min={1}
              defaultValue={promotion?.getQty || 1}
              required
              disabled={disabled}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="promo-min-purchase" className="text-sm font-medium">
          Minimum belanja (Rp, 0 = tanpa syarat)
        </label>
        <Input
          id="promo-min-purchase"
          name="minPurchase"
          type="number"
          min={0}
          defaultValue={promotion?.minPurchase ?? 0}
          disabled={disabled}
          className={inputClass}
        />
      </div>

      {scope !== "all" && (
        <ScopeRefField
          scope={scope}
          categories={categories}
          defaultId={promotion?.scopeRefId ?? ""}
          defaultName={
            promotion?.scopeRefId
              ? (scopeNames[promotion.scopeRefId] ?? "")
              : ""
          }
          disabled={disabled}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="promo-start" className="text-sm font-medium">
            Mulai
          </label>
          <Input
            id="promo-start"
            name="startAt"
            type="date"
            defaultValue={promotion ? promotion.startAt.slice(0, 10) : today}
            required
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="promo-end" className="text-sm font-medium">
            Selesai
          </label>
          <Input
            id="promo-end"
            name="endAt"
            type="date"
            defaultValue={promotion ? promotion.endAt.slice(0, 10) : today}
            required
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>
    </>
  );
}

export function PromotionManagement({
  promotions,
  categories,
  scopeNames,
}: {
  promotions: PromotionDTO[];
  categories: ScopeOption[];
  scopeNames: Record<string, string>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionDTO | null>(null);
  const [state, setState] = useState<PromotionActionState>(initialState);
  const [pending, startTransition] = useTransition();

  function submit(
    action: (
      prev: PromotionActionState,
      formData: FormData
    ) => Promise<PromotionActionState>,
    formData: FormData,
    onSuccess: () => void
  ) {
    startTransition(async () => {
      const result = await action(initialState, formData);
      setState(result);
      if (result.success) {
        onSuccess();
      }
    });
  }

  function handleToggle(promo: PromotionDTO) {
    startTransition(async () => {
      const result = await togglePromotionAction(promo.id, !promo.isActive);
      setState(result);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Promo</h1>
          <p className="text-sm text-muted-foreground">
            Diskon otomatis yang berlaku di layar kasir
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={() => {
            setState(initialState);
            setCreateOpen(true);
          }}
        >
          Tambah promo
        </Button>
      </div>

      {state.message && (
        <p
          role={state.success ? "status" : "alert"}
          className={`text-sm ${state.success ? "text-green-600" : "text-destructive"}`}
        >
          {state.message}
        </p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Promo</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead className="text-right">Min. belanja</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.map((promo) => {
              const status = statusOf(promo);
              return (
                <TableRow key={promo.id}>
                  <TableCell className="font-medium">{promo.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{describe(promo)}</span>
                      <span className="text-xs text-muted-foreground">
                        {SCOPE_LABELS[promo.scope]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateJakarta(promo.startAt)} —{" "}
                    {formatDateJakarta(promo.endAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {promo.minPurchase > 0
                      ? `Rp ${promo.minPurchase.toLocaleString("id-ID")}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded px-2 py-1 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setState(initialState);
                          setEditing(promo);
                        }}
                      >
                        Ubah
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        loading={pending}
                        onClick={() => handleToggle(promo)}
                      >
                        {promo.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {promotions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  Belum ada promo. Buat promo pertama untuk diterapkan otomatis
                  di kasir.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah promo</DialogTitle>
            <DialogDescription>
              Promo aktif otomatis dihitung saat kasir menghitung keranjang.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(fd) =>
              submit(createPromotionAction, fd, () => setCreateOpen(false))
            }
            className="flex flex-col gap-4"
          >
            <PromotionFields
              categories={categories}
              scopeNames={scopeNames}
              disabled={pending}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="submit" disabled={pending} loading={pending}>
                {pending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ubah promo</DialogTitle>
            <DialogDescription>
              Tipe dan sasaran promo tidak dapat diubah; buat promo baru jika
              perlu.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              action={(fd) =>
                submit(updatePromotionAction, fd, () => setEditing(null))
              }
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="promotionId" value={editing.id} />
              <PromotionFields
                promotion={editing}
                categories={categories}
                scopeNames={scopeNames}
                disabled={pending}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                  disabled={pending}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={pending} loading={pending}>
                  {pending ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

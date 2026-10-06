"use client";

import { useState, useTransition } from "react";
import {
  createVoucherAction,
  toggleVoucherAction,
  type PromotionActionState,
  type VoucherDTO,
} from "@/modules/promotions/presentation/actions/promotion.action";
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

const initialState: PromotionActionState = { success: false, message: null };
const inputClass = "min-h-11";
const selectClass =
  "min-h-11 rounded-md border border-input bg-transparent px-3 text-sm";

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";
  for (let i = 0; i < 6; i += 1) {
    body += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `VCH-${body}`;
}

function statusOf(voucher: VoucherDTO): { label: string; className: string } {
  if (!voucher.isActive) {
    return { label: "Nonaktif", className: "bg-muted text-muted-foreground" };
  }
  if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < Date.now()) {
    return { label: "Kedaluwarsa", className: "bg-red-100 text-red-700" };
  }
  if (voucher.remainingQuota <= 0) {
    return { label: "Kuota habis", className: "bg-amber-100 text-amber-700" };
  }
  return { label: "Aktif", className: "bg-green-100 text-green-700" };
}

function VoucherFields({ disabled }: { disabled?: boolean }) {
  const [type, setType] = useState<"percent" | "amount">("percent");
  const [code, setCode] = useState("");

  return (
    <>
      <div className="flex flex-col gap-2">
        <label htmlFor="voucher-code" className="text-sm font-medium">
          Kode voucher
        </label>
        <div className="flex gap-2">
          <Input
            id="voucher-code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            disabled={disabled}
            className={inputClass}
            placeholder="VCH-XXXXXX"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => setCode(randomCode())}
          >
            Acak
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Huruf, angka, dan strip; wajib unik.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="voucher-type" className="text-sm font-medium">
            Tipe
          </label>
          <select
            id="voucher-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "percent" | "amount")}
            disabled={disabled}
            className={selectClass}
          >
            <option value="percent">Diskon persen</option>
            <option value="amount">Diskon nominal</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="voucher-value" className="text-sm font-medium">
            {type === "percent" ? "Nilai (%)" : "Nilai (Rp)"}
          </label>
          <Input
            id="voucher-value"
            name="value"
            type="number"
            min={0}
            max={type === "percent" ? 100 : undefined}
            required
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="voucher-quota" className="text-sm font-medium">
            Kuota pemakaian
          </label>
          <Input
            id="voucher-quota"
            name="quota"
            type="number"
            min={1}
            defaultValue={1}
            required
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="voucher-min-purchase" className="text-sm font-medium">
            Minimum belanja (Rp)
          </label>
          <Input
            id="voucher-min-purchase"
            name="minPurchase"
            type="number"
            min={0}
            defaultValue={0}
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="voucher-expires" className="text-sm font-medium">
          Berlaku s/d (opsional)
        </label>
        <Input
          id="voucher-expires"
          name="expiresAt"
          type="date"
          disabled={disabled}
          className={inputClass}
        />
      </div>
    </>
  );
}

export function VoucherManagement({ vouchers }: { vouchers: VoucherDTO[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [state, setState] = useState<PromotionActionState>(initialState);
  const [pending, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createVoucherAction(initialState, formData);
      setState(result);
      if (result.success) {
        setCreateOpen(false);
      }
    });
  }

  function handleToggle(voucher: VoucherDTO) {
    startTransition(async () => {
      const result = await toggleVoucherAction(voucher.id, !voucher.isActive);
      setState(result);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Voucher</h1>
          <p className="text-sm text-muted-foreground">
            Kode yang dimasukkan kasir saat transaksi (POS-13)
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={() => {
            setState(initialState);
            setCreateOpen(true);
          }}
        >
          Tambah voucher
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
              <TableHead>Kode</TableHead>
              <TableHead>Nilai</TableHead>
              <TableHead className="text-right">Kuota</TableHead>
              <TableHead className="text-right">Min. belanja</TableHead>
              <TableHead>Berlaku s/d</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vouchers.map((voucher) => {
              const status = statusOf(voucher);
              return (
                <TableRow key={voucher.id}>
                  <TableCell className="font-mono font-medium">
                    {voucher.code}
                  </TableCell>
                  <TableCell>
                    {voucher.type === "percent"
                      ? `${voucher.value}%`
                      : `Rp ${voucher.value.toLocaleString("id-ID")}`}
                  </TableCell>
                  <TableCell className="text-right">
                    {voucher.usedCount} / {voucher.quota}
                  </TableCell>
                  <TableCell className="text-right">
                    {voucher.minPurchase > 0
                      ? `Rp ${voucher.minPurchase.toLocaleString("id-ID")}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {voucher.expiresAt
                      ? formatDateJakarta(voucher.expiresAt)
                      : "Tidak berbatas"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded px-2 py-1 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleToggle(voucher)}
                    >
                      {voucher.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {vouchers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Belum ada voucher
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah voucher</DialogTitle>
            <DialogDescription>
              Voucher dipakai satu kali per transaksi dan divalidasi ulang oleh
              server.
            </DialogDescription>
          </DialogHeader>
          <form action={handleCreate} className="flex flex-col gap-4">
            <VoucherFields disabled={pending} />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

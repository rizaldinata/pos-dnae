"use client";

import { useState, useTransition } from "react";
import {
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
  type PurchasingActionState,
  type SupplierDTO,
} from "@/modules/purchasing/presentation/actions/purchasing.action";
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

const initialState: PurchasingActionState = { success: false, message: null };
const inputClass = "min-h-11";

function SupplierFields({
  supplier,
  disabled,
}: {
  supplier?: SupplierDTO;
  disabled?: boolean;
}) {
  const idPrefix = supplier ? "sup-edit" : "sup";
  return (
    <>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-name`} className="text-sm font-medium">
          Nama supplier
        </label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          defaultValue={supplier?.name ?? ""}
          required
          disabled={disabled}
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-phone`} className="text-sm font-medium">
            Telepon
          </label>
          <Input
            id={`${idPrefix}-phone`}
            name="phone"
            defaultValue={supplier?.phone ?? ""}
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${idPrefix}-terms`} className="text-sm font-medium">
            Termin (hari)
          </label>
          <Input
            id={`${idPrefix}-terms`}
            name="paymentTermsDays"
            type="number"
            min={0}
            defaultValue={supplier?.paymentTermsDays ?? 0}
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-address`} className="text-sm font-medium">
          Alamat
        </label>
        <Input
          id={`${idPrefix}-address`}
          name="address"
          defaultValue={supplier?.address ?? ""}
          disabled={disabled}
          className={inputClass}
        />
      </div>
    </>
  );
}

export function SupplierManagement({
  suppliers,
}: {
  suppliers: SupplierDTO[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierDTO | null>(null);
  const [state, setState] = useState<PurchasingActionState>(initialState);
  const [pending, startTransition] = useTransition();

  function submit(
    action: (
      prev: PurchasingActionState,
      formData: FormData
    ) => Promise<PurchasingActionState>,
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

  function handleDelete(supplier: SupplierDTO) {
    if (!confirm(`Hapus supplier "${supplier.name}"?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteSupplierAction(supplier.id);
      setState(result);
    });
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Supplier</h1>
          <p className="text-sm text-muted-foreground">
            Rekanan pemasok barang
          </p>
        </div>
        <Button
          onClick={() => {
            setState(initialState);
            setCreateOpen(true);
          }}
          className="min-h-11"
        >
          Tambah supplier
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
              <TableHead>Telepon</TableHead>
              <TableHead className="text-right">Termin</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>{supplier.phone || "-"}</TableCell>
                <TableCell className="text-right">
                  {supplier.paymentTermsDays} hari
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setState(initialState);
                        setEditing(supplier);
                      }}
                    >
                      Ubah
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      loading={pending}
                      onClick={() => handleDelete(supplier)}
                    >
                      Hapus
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {suppliers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  Belum ada supplier
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah supplier</DialogTitle>
            <DialogDescription>Catat rekanan pemasok baru</DialogDescription>
          </DialogHeader>
          <form
            action={(fd) =>
              submit(createSupplierAction, fd, () => setCreateOpen(false))
            }
            className="flex flex-col gap-4"
          >
            <SupplierFields disabled={pending} />
            <DialogFooter>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah supplier</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              key={editing.id}
              action={(fd) =>
                submit(updateSupplierAction, fd, () => setEditing(null))
              }
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="supplierId" value={editing.id} />
              <SupplierFields supplier={editing} disabled={pending} />
              <DialogFooter>
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

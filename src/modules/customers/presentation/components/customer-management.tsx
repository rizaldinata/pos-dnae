"use client";

import { useState, useTransition } from "react";
import {
  createCustomerAction,
  deleteCustomerAction,
  updateCustomerAction,
  type CustomerActionState,
  type CustomerDTO,
} from "@/modules/customers/presentation/actions/customer.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
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
import { formatRupiah } from "@/shared/lib/format-rupiah";

const initialState: CustomerActionState = { success: false, message: null };
const inputClass = "min-h-11";

function CustomerFields({
  customer,
  disabled,
}: {
  customer?: CustomerDTO;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <label
          htmlFor={customer ? "cust-edit-name" : "cust-name"}
          className="text-sm font-medium"
        >
          Nama
        </label>
        <Input
          id={customer ? "cust-edit-name" : "cust-name"}
          name="name"
          defaultValue={customer?.name ?? ""}
          required
          disabled={disabled}
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label
            htmlFor={customer ? "cust-edit-phone" : "cust-phone"}
            className="text-sm font-medium"
          >
            Telepon
          </label>
          <Input
            id={customer ? "cust-edit-phone" : "cust-phone"}
            name="phone"
            defaultValue={customer?.phone ?? ""}
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor={customer ? "cust-edit-email" : "cust-email"}
            className="text-sm font-medium"
          >
            Email
          </label>
          <Input
            id={customer ? "cust-edit-email" : "cust-email"}
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            disabled={disabled}
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label
          htmlFor={customer ? "cust-edit-address" : "cust-address"}
          className="text-sm font-medium"
        >
          Alamat
        </label>
        <Input
          id={customer ? "cust-edit-address" : "cust-address"}
          name="address"
          defaultValue={customer?.address ?? ""}
          disabled={disabled}
          className={inputClass}
        />
      </div>
    </>
  );
}

export function CustomerManagement({
  customers,
}: {
  customers: CustomerDTO[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerDTO | null>(null);
  const [state, setState] = useState<CustomerActionState>(initialState);
  const [pending, startTransition] = useTransition();

  function submit(
    action: (
      prev: CustomerActionState,
      formData: FormData
    ) => Promise<CustomerActionState>,
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

  function handleDelete(customer: CustomerDTO) {
    if (
      !confirm(
        `Hapus pelanggan "${customer.name}"? Riwayat transaksi tetap tersimpan.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteCustomerAction(customer.id);
      setState(result);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pelanggan</h1>
          <p className="text-sm text-muted-foreground">Data pelanggan toko</p>
        </div>
        <Button
          onClick={() => {
            setState(initialState);
            setCreateOpen(true);
          }}
          className="min-h-11"
        >
          Tambah pelanggan
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
              <TableHead className="text-right">Poin</TableHead>
              <TableHead className="text-right">Piutang</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">
                  <a
                    href={`/pelanggan/${customer.id}`}
                    className="hover:underline"
                  >
                    {customer.name}
                  </a>
                </TableCell>
                <TableCell>{customer.phone || "-"}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">{customer.points}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatRupiah(customer.receivableBalance)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setState(initialState);
                        setEditing(customer);
                      }}
                    >
                      Ubah
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleDelete(customer)}
                    >
                      Hapus
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  Belum ada pelanggan
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah pelanggan</DialogTitle>
            <DialogDescription>Catat data pelanggan baru</DialogDescription>
          </DialogHeader>
          <form
            action={(fd) =>
              submit(createCustomerAction, fd, () => setCreateOpen(false))
            }
            className="flex flex-col gap-4"
          >
            <CustomerFields disabled={pending} />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
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
            <DialogTitle>Ubah pelanggan</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              key={editing.id}
              action={(fd) =>
                submit(updateCustomerAction, fd, () => setEditing(null))
              }
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="customerId" value={editing.id} />
              <CustomerFields customer={editing} disabled={pending} />
              <DialogFooter>
                <Button type="submit" disabled={pending}>
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

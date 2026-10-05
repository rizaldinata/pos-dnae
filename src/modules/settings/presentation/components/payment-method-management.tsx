"use client";

import { useState, useTransition } from "react";
import {
  createPaymentMethodAction,
  togglePaymentMethodAction,
  updatePaymentMethodAction,
  type PaymentMethodActionState,
} from "@/modules/settings/presentation/actions/payment-method.action";
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

export interface PaymentMethodRow {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  cash: "Tunai",
  card: "Kartu / EDC",
  qris: "QRIS",
  transfer: "Transfer Bank",
  ewallet: "E-Wallet",
};

const initialState: PaymentMethodActionState = {
  success: false,
  message: null,
};
const selectClass =
  "flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function PaymentMethodManagement({
  methods,
}: {
  methods: PaymentMethodRow[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethodRow | null>(null);
  const [state, setState] = useState<PaymentMethodActionState>(initialState);
  const [pending, startTransition] = useTransition();

  function submit(
    action: (
      prev: PaymentMethodActionState,
      formData: FormData
    ) => Promise<PaymentMethodActionState>,
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

  function handleToggle(method: PaymentMethodRow) {
    startTransition(async () => {
      const result = await togglePaymentMethodAction(
        method.id,
        !method.isActive
      );
      setState(result);
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Metode Pembayaran</h1>
          <p className="text-sm text-muted-foreground">
            Metode yang tampil di dialog pembayaran kasir
          </p>
        </div>
        <Button
          onClick={() => {
            setState(initialState);
            setCreateOpen(true);
          }}
          className="min-h-11"
        >
          Tambah metode
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
              <TableHead>Tipe</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.map((method) => (
              <TableRow key={method.id}>
                <TableCell className="font-medium">{method.name}</TableCell>
                <TableCell>{TYPE_LABEL[method.type] ?? method.type}</TableCell>
                <TableCell>
                  <Badge variant={method.isActive ? "default" : "secondary"}>
                    {method.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setState(initialState);
                        setEditing(method);
                      }}
                    >
                      Ubah
                    </Button>
                    <Button
                      variant={method.isActive ? "ghost" : "outline"}
                      size="sm"
                      disabled={pending}
                      onClick={() => handleToggle(method)}
                    >
                      {method.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {methods.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  Belum ada metode pembayaran
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah metode pembayaran</DialogTitle>
            <DialogDescription>
              Metode baru langsung aktif dan tampil di kasir
            </DialogDescription>
          </DialogHeader>
          <form
            action={(fd) =>
              submit(createPaymentMethodAction, fd, () => setCreateOpen(false))
            }
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="pm-name" className="text-sm font-medium">
                Nama metode
              </label>
              <Input
                id="pm-name"
                name="name"
                required
                disabled={pending}
                className="min-h-11"
                placeholder="cth. QRIS Toko"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="pm-type" className="text-sm font-medium">
                Tipe
              </label>
              <select
                id="pm-type"
                name="type"
                className={selectClass}
                defaultValue="qris"
                disabled={pending}
              >
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
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
            <DialogTitle>Ubah metode pembayaran</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              key={editing.id}
              action={(fd) =>
                submit(updatePaymentMethodAction, fd, () => setEditing(null))
              }
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="paymentMethodId" value={editing.id} />
              <div className="flex flex-col gap-2">
                <label htmlFor="pm-edit-name" className="text-sm font-medium">
                  Nama metode
                </label>
                <Input
                  id="pm-edit-name"
                  name="name"
                  defaultValue={editing.name}
                  required
                  disabled={pending}
                  className="min-h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="pm-edit-type" className="text-sm font-medium">
                  Tipe
                </label>
                <select
                  id="pm-edit-type"
                  name="type"
                  className={selectClass}
                  defaultValue={editing.type}
                  disabled={pending}
                >
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
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

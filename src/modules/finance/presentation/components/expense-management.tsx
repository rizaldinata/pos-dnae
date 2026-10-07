"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createExpenseCategoryAction,
  deleteExpenseAction,
  deleteExpenseCategoryAction,
  recordExpenseAction,
  updateExpenseAction,
  updateExpenseCategoryAction,
  type ExpenseActionState,
} from "@/modules/finance/presentation/actions/expense.action";
import { formatRupiah } from "@/shared/lib/format-rupiah";
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

export interface ExpenseDTO {
  id: string;
  categoryId: string;
  amount: number;
  note: string;
  /** YYYY-MM-DD */
  expenseDate: string;
}

export interface ExpenseCategoryDTO {
  id: string;
  name: string;
}

const initialState: ExpenseActionState = { success: false, message: null };
const inputClass = "min-h-11";
const selectClass =
  "min-h-11 rounded-md border border-input bg-transparent px-3 text-sm";

function ExpenseFields({
  expense,
  categories,
  disabled,
}: {
  expense?: ExpenseDTO;
  categories: ExpenseCategoryDTO[];
  disabled?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <input type="hidden" name="expenseId" value={expense?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="expense-date" className="text-sm font-medium">
            Tanggal
          </label>
          <Input
            id="expense-date"
            name="expenseDate"
            type="date"
            defaultValue={expense?.expenseDate ?? today}
            required
            disabled={disabled}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="expense-category" className="text-sm font-medium">
            Kategori
          </label>
          <select
            id="expense-category"
            name="categoryId"
            defaultValue={expense?.categoryId ?? ""}
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
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="expense-amount" className="text-sm font-medium">
          Nominal (Rp)
        </label>
        <Input
          id="expense-amount"
          name="amount"
          type="number"
          min={1}
          step="any"
          defaultValue={expense?.amount ?? ""}
          required
          disabled={disabled}
          className={inputClass}
          placeholder="Mis. 150000"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="expense-note" className="text-sm font-medium">
          Catatan
        </label>
        <Input
          id="expense-note"
          name="note"
          defaultValue={expense?.note ?? ""}
          disabled={disabled}
          className={inputClass}
          placeholder="Mis. Bayar listrik toko"
          maxLength={300}
        />
      </div>
    </>
  );
}

function CategoryManager({
  categories,
  disabled,
  onState,
}: {
  categories: ExpenseCategoryDTO[];
  disabled: boolean;
  onState: (state: ExpenseActionState) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<string | null>(null);

  function run(action: () => Promise<ExpenseActionState>) {
    startTransition(async () => {
      onState(await action());
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        action={(fd) => {
          run(async () => {
            const state = await createExpenseCategoryAction(initialState, fd);
            return state;
          });
        }}
        className="flex items-end gap-2"
      >
        <div className="flex flex-1 flex-col gap-2">
          <label htmlFor="new-category" className="text-sm font-medium">
            Kategori baru
          </label>
          <Input
            id="new-category"
            name="name"
            required
            minLength={2}
            maxLength={60}
            disabled={disabled || pending}
            className={inputClass}
            placeholder="Mis. Listrik"
          />
        </div>
        <Button type="submit" disabled={disabled || pending} loading={pending}>
          Tambah
        </Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama kategori</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  {renaming === category.id ? (
                    <form
                      action={(fd) => {
                        setRenaming(null);
                        run(() =>
                          updateExpenseCategoryAction(initialState, fd)
                        );
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="hidden"
                        name="categoryId"
                        value={category.id}
                      />
                      <Input
                        name="name"
                        defaultValue={category.name}
                        required
                        minLength={2}
                        maxLength={60}
                        disabled={pending}
                        className="min-h-9"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={pending}
                        loading={pending}
                      >
                        Simpan
                      </Button>
                    </form>
                  ) : (
                    category.name
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {renaming !== category.id && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRenaming(category.id)}
                      >
                        Ubah
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        loading={pending}
                        onClick={() => {
                          if (confirm(`Hapus kategori "${category.name}"?`)) {
                            run(() => deleteExpenseCategoryAction(category.id));
                          }
                        }}
                      >
                        Hapus
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="text-center text-muted-foreground"
                >
                  Belum ada kategori. Buat kategori pertama untuk mencatat
                  pengeluaran.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Kategori yang sudah dipakai pengeluaran tidak dapat dihapus.
      </p>
    </div>
  );
}

export function ExpenseManagement({
  expenses,
  categories,
  total,
  page,
  pageSize,
}: {
  expenses: ExpenseDTO[];
  categories: ExpenseCategoryDTO[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseDTO | null>(null);
  const [state, setState] = useState<ExpenseActionState>(initialState);
  const [pending, startTransition] = useTransition();

  const categoryNames = Object.fromEntries(
    categories.map((c) => [c.id, c.name])
  );
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(next));
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  function submit(
    action: (
      prev: ExpenseActionState,
      formData: FormData
    ) => Promise<ExpenseActionState>,
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

  function handleDelete(expense: ExpenseDTO) {
    if (
      !confirm(
        `Hapus pengeluaran "${formatRupiah(expense.amount)}" pada ${expense.expenseDate}?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      setState(await deleteExpenseAction(expense.id));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Pengeluaran operasional</h1>
          <p className="text-sm text-muted-foreground">
            Catatan kas keluar di luar transaksi (FIN-01)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setState(initialState);
              setCategoryOpen(true);
            }}
          >
            Kelola kategori
          </Button>
          <Button
            className="min-h-11"
            onClick={() => {
              setState(initialState);
              setCreateOpen(true);
            }}
          >
            Catat pengeluaran
          </Button>
        </div>
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
              <TableHead>Tanggal</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="text-right">Nominal</TableHead>
              <TableHead>Catatan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="whitespace-nowrap">
                  {expense.expenseDate}
                </TableCell>
                <TableCell>
                  {categoryNames[expense.categoryId] ?? "-"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatRupiah(expense.amount)}
                </TableCell>
                <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                  {expense.note || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setState(initialState);
                        setEditing(expense);
                      }}
                    >
                      Ubah
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      loading={pending}
                      onClick={() => handleDelete(expense)}
                    >
                      Hapus
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  Belum ada pengeluaran pada periode ini.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Menampilkan {first}–{last} dari {total} pengeluaran
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Berikutnya
          </Button>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat pengeluaran</DialogTitle>
            <DialogDescription>
              Pengeluaran langsung masuk ke laporan kas keluar dan laba rugi.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(fd) =>
              submit(recordExpenseAction, fd, () => setCreateOpen(false))
            }
            className="flex flex-col gap-4"
          >
            <ExpenseFields categories={categories} disabled={pending} />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah pengeluaran</DialogTitle>
            <DialogDescription>
              Perbarui tanggal, kategori, nominal, atau catatan.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              action={(fd) =>
                submit(updateExpenseAction, fd, () => setEditing(null))
              }
              className="flex flex-col gap-4"
            >
              <ExpenseFields
                expense={editing}
                categories={categories}
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

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kategori pengeluaran</DialogTitle>
            <DialogDescription>
              Kelompokkan pengeluaran agar rincian laba rugi mudah dibaca.
            </DialogDescription>
          </DialogHeader>
          <CategoryManager
            categories={categories}
            disabled={pending}
            onState={setState}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCategoryOpen(false)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

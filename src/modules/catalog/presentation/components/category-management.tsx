"use client";

import { useState, useTransition } from "react";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
  type MasterDataActionState,
} from "@/modules/catalog/presentation/actions/master-data.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

export interface CategoryRow {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
}

const initialState: MasterDataActionState = { success: false, message: null };
const selectClass =
  "flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function CategoryManagement({
  categories,
}: {
  categories: CategoryRow[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [state, setState] = useState<MasterDataActionState>(initialState);
  const [pending, startTransition] = useTransition();

  function submit(
    action: (
      prev: MasterDataActionState,
      formData: FormData
    ) => Promise<MasterDataActionState>,
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

  function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus kategori "${name}"?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      setState(result);
    });
  }

  const parentOptions = (excludeId?: string) =>
    categories.filter((c) => c.id !== excludeId);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kategori</h1>
          <p className="text-sm text-muted-foreground">
            Kategori bertingkat untuk pengelompokan produk
          </p>
        </div>
        <Button
          onClick={() => {
            setState(initialState);
            setCreateOpen(true);
          }}
          className="min-h-11"
        >
          Tambah kategori
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
        <ul className="divide-y">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex min-h-11 items-center gap-2 px-3 py-2"
            >
              <span
                style={{ paddingLeft: `${c.depth * 1.5}rem` }}
                className="flex-1 text-sm font-medium"
              >
                {c.depth > 0 && (
                  <span className="mr-1 text-muted-foreground">└</span>
                )}
                {c.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setState(initialState);
                  setEditing(c);
                }}
              >
                Ubah
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(c.id, c.name)}
                disabled={pending}
              >
                Hapus
              </Button>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              Belum ada kategori
            </li>
          )}
        </ul>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah kategori</DialogTitle>
            <DialogDescription>
              Buat kategori baru, opsional di bawah induk
            </DialogDescription>
          </DialogHeader>
          <form
            action={(fd) =>
              submit(createCategoryAction, fd, () => setCreateOpen(false))
            }
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="cat-name" className="text-sm font-medium">
                Nama kategori
              </label>
              <Input
                id="cat-name"
                name="name"
                required
                disabled={pending}
                className="min-h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="cat-parent" className="text-sm font-medium">
                Induk (opsional)
              </label>
              <select
                id="cat-parent"
                name="parentId"
                className={selectClass}
                defaultValue=""
                disabled={pending}
              >
                <option value="">Tanpa induk (kategori utama)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"—".repeat(c.depth)} {c.name}
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
            <DialogTitle>Ubah kategori</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              key={editing.id}
              action={(fd) =>
                submit(updateCategoryAction, fd, () => setEditing(null))
              }
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="categoryId" value={editing.id} />
              <div className="flex flex-col gap-2">
                <label htmlFor="cat-edit-name" className="text-sm font-medium">
                  Nama kategori
                </label>
                <Input
                  id="cat-edit-name"
                  name="name"
                  defaultValue={editing.name}
                  required
                  disabled={pending}
                  className="min-h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="cat-edit-parent"
                  className="text-sm font-medium"
                >
                  Induk
                </label>
                <select
                  id="cat-edit-parent"
                  name="parentId"
                  className={selectClass}
                  defaultValue={editing.parentId ?? "__root__"}
                  disabled={pending}
                >
                  <option value="__root__">Tanpa induk (kategori utama)</option>
                  {parentOptions(editing.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {"—".repeat(c.depth)} {c.name}
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

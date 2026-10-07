"use client";

import { useState, useTransition } from "react";
import type { MasterDataActionState } from "@/modules/catalog/presentation/actions/master-data.action";
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

export interface SimpleMasterRow {
  id: string;
  name: string;
  shortName?: string;
}

const initialState: MasterDataActionState = { success: false, message: null };

type ActionFn = (
  prev: MasterDataActionState,
  formData: FormData
) => Promise<MasterDataActionState>;

export function SimpleMasterManagement({
  title,
  description,
  itemLabel,
  idField,
  items,
  createAction,
  updateAction,
  deleteAction,
  secondField,
}: {
  title: string;
  description: string;
  itemLabel: string;
  idField: string;
  items: SimpleMasterRow[];
  createAction: ActionFn;
  updateAction: ActionFn;
  deleteAction: (id: string) => Promise<MasterDataActionState>;
  secondField?: { name: string; label: string };
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SimpleMasterRow | null>(null);
  const [state, setState] = useState<MasterDataActionState>(initialState);
  const [pending, startTransition] = useTransition();

  function submit(action: ActionFn, formData: FormData, onSuccess: () => void) {
    startTransition(async () => {
      const result = await action(initialState, formData);
      setState(result);
      if (result.success) {
        onSuccess();
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus ${itemLabel.toLowerCase()} "${name}"?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteAction(id);
      setState(result);
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          onClick={() => {
            setState(initialState);
            setCreateOpen(true);
          }}
          className="min-h-11"
        >
          Tambah {itemLabel.toLowerCase()}
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
          {items.map((item) => (
            <li
              key={item.id}
              className="flex min-h-11 items-center gap-2 px-3 py-2"
            >
              <span className="flex-1 text-sm font-medium">
                {item.name}
                {item.shortName && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({item.shortName})
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setState(initialState);
                  setEditing(item);
                }}
              >
                Ubah
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id, item.name)}
                disabled={pending}
                loading={pending}
              >
                Hapus
              </Button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              Belum ada data
            </li>
          )}
        </ul>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah {itemLabel.toLowerCase()}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <form
            action={(fd) =>
              submit(createAction, fd, () => setCreateOpen(false))
            }
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="simple-name" className="text-sm font-medium">
                Nama {itemLabel.toLowerCase()}
              </label>
              <Input
                id="simple-name"
                name="name"
                required
                disabled={pending}
                className="min-h-11"
              />
            </div>
            {secondField && (
              <div className="flex flex-col gap-2">
                <label htmlFor="simple-second" className="text-sm font-medium">
                  {secondField.label}
                </label>
                <Input
                  id="simple-second"
                  name={secondField.name}
                  required
                  disabled={pending}
                  className="min-h-11"
                />
              </div>
            )}
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
            <DialogTitle>Ubah {itemLabel.toLowerCase()}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              key={editing.id}
              action={(fd) => submit(updateAction, fd, () => setEditing(null))}
              className="flex flex-col gap-4"
            >
              <input type="hidden" name={idField} value={editing.id} />
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="simple-edit-name"
                  className="text-sm font-medium"
                >
                  Nama {itemLabel.toLowerCase()}
                </label>
                <Input
                  id="simple-edit-name"
                  name="name"
                  defaultValue={editing.name}
                  required
                  disabled={pending}
                  className="min-h-11"
                />
              </div>
              {secondField && (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="simple-edit-second"
                    className="text-sm font-medium"
                  >
                    {secondField.label}
                  </label>
                  <Input
                    id="simple-edit-second"
                    name={secondField.name}
                    defaultValue={editing.shortName ?? ""}
                    required
                    disabled={pending}
                    className="min-h-11"
                  />
                </div>
              )}
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

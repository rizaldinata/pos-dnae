"use client";

import { useState, useTransition } from "react";
import {
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
  type PermissionDTO,
  type RoleActionState,
  type RoleDTO,
} from "@/modules/iam/presentation/actions/role.action";
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

const initialState: RoleActionState = { success: false, message: null };

function PermissionGrid({
  permissions,
  selected,
  disabled,
  prefix,
}: {
  permissions: PermissionDTO[];
  selected: string[];
  disabled?: boolean;
  prefix: string;
}) {
  const [checked, setChecked] = useState<string[]>(selected);

  function toggle(code: string) {
    setChecked((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  return (
    <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
      {permissions.map((p) => (
        <label
          key={p.code}
          className="flex min-h-11 cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-accent"
        >
          <input
            type="checkbox"
            name="permissions"
            value={p.code}
            checked={checked.includes(p.code)}
            onChange={() => toggle(p.code)}
            disabled={disabled}
            className="mt-1 size-4"
          />
          <span>
            <span className="font-mono font-medium">{p.code}</span>
            <span className="block text-muted-foreground">
              {p.description || `${prefix} ${p.code}`}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function RoleManagement({
  roles,
  permissions,
}: {
  roles: RoleDTO[];
  permissions: PermissionDTO[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RoleDTO | null>(null);
  const [state, setState] = useState<RoleActionState>(initialState);
  const [pending, startTransition] = useTransition();

  function submit(
    action: (
      prev: RoleActionState,
      formData: FormData
    ) => Promise<RoleActionState>,
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

  function handleDelete(role: RoleDTO) {
    if (!confirm(`Hapus role "${role.name}"?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteRoleAction(role.id);
      setState(result);
    });
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Role & Permission</h1>
          <p className="text-sm text-muted-foreground">
            Role sistem tidak dapat dihapus, permission-nya dapat diubah
          </p>
        </div>
        <Button
          onClick={() => {
            setState(initialState);
            setCreateOpen(true);
          }}
          className="min-h-11"
        >
          Tambah role
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
              <TableHead>Role</TableHead>
              <TableHead>Pengguna</TableHead>
              <TableHead>Permission</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  {role.name}{" "}
                  {role.isSystem && (
                    <Badge variant="secondary" className="text-[10px]">
                      Sistem
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{role.userCount}</TableCell>
                <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
                  {role.permissions.length > 0
                    ? role.permissions.join(", ")
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setState(initialState);
                        setEditing(role);
                      }}
                    >
                      Ubah
                    </Button>
                    {!role.isSystem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        loading={pending}
                        onClick={() => handleDelete(role)}
                      >
                        Hapus
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah role</DialogTitle>
            <DialogDescription>
              Pilih permission untuk role baru
            </DialogDescription>
          </DialogHeader>
          <form
            action={(fd) =>
              submit(createRoleAction, fd, () => setCreateOpen(false))
            }
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="role-name" className="text-sm font-medium">
                Nama role
              </label>
              <Input
                id="role-name"
                name="name"
                required
                disabled={pending}
                className="min-h-11"
              />
            </div>
            <PermissionGrid
              permissions={permissions}
              selected={[]}
              disabled={pending}
              prefix="Buat"
            />
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ubah role</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              key={editing.id}
              action={(fd) =>
                submit(updateRoleAction, fd, () => setEditing(null))
              }
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="roleId" value={editing.id} />
              <div className="flex flex-col gap-2">
                <label htmlFor="role-edit-name" className="text-sm font-medium">
                  Nama role
                </label>
                <Input
                  id="role-edit-name"
                  name="name"
                  defaultValue={editing.name}
                  required
                  disabled={pending}
                  className="min-h-11"
                />
              </div>
              <PermissionGrid
                permissions={permissions}
                selected={editing.permissions}
                disabled={pending}
                prefix="Ubah"
              />
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

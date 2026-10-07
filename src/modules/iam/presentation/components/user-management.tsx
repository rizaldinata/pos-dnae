"use client";

import { useState, useTransition } from "react";
import {
  createUserAction,
  updateUserAction,
  type UsersActionState,
} from "@/modules/iam/presentation/actions/users.action";
import { setPinAction } from "@/modules/iam/presentation/actions/pin.action";
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

export interface UserRow {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
}

export interface RoleOption {
  id: string;
  name: string;
}

const initialState: UsersActionState = { success: false, message: null };

function RoleSelect({
  roles,
  defaultValue,
  disabled,
  id,
}: {
  roles: RoleOption[];
  defaultValue?: string;
  disabled?: boolean;
  id?: string;
}) {
  // Default ke role dengan hak paling kecil (Kasir) bila ada — hindari
  // tidak sengaja membuat Admin karena urutan alfabet.
  const fallback = roles.find((r) => r.name === "Kasir")?.id ?? roles[0]?.id;
  return (
    <select
      id={id}
      name="roleId"
      defaultValue={defaultValue ?? fallback}
      disabled={disabled}
      required
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {roles.map((role) => (
        <option key={role.id} value={role.id}>
          {role.name}
        </option>
      ))}
    </select>
  );
}

export function UserManagement({
  users,
  roles,
  currentUserId,
}: {
  users: UserRow[];
  roles: RoleOption[];
  currentUserId: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const [createState, setCreateState] =
    useState<UsersActionState>(initialState);
  const [updateState, setUpdateState] =
    useState<UsersActionState>(initialState);
  const [createPending, startCreate] = useTransition();
  const [updatePending, startUpdate] = useTransition();

  function handleCreate(formData: FormData) {
    startCreate(async () => {
      const result = await createUserAction(initialState, formData);
      setCreateState(result);
      if (result.success) {
        setCreateOpen(false);
      }
    });
  }

  function handleUpdate(formData: FormData) {
    startUpdate(async () => {
      const result = await updateUserAction(initialState, formData);
      const pin = String(formData.get("pin") ?? "").trim();
      if (result.success && pin !== "") {
        const pinResult = await setPinAction(
          String(formData.get("userId") ?? ""),
          pin
        );
        if (!pinResult.success) {
          setUpdateState({
            success: false,
            message: `Data tersimpan, tetapi PIN gagal: ${pinResult.message}`,
          });
          return;
        }
      }
      setUpdateState(result);
      if (result.success) {
        setEditing(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pengguna</h1>
          <p className="text-sm text-muted-foreground">
            Kelola akun dan hak akses pengguna toko
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateState(initialState);
            setCreateOpen(true);
          }}
          className="min-h-11"
        >
          Tambah pengguna
        </Button>
      </div>

      {createState.message && !createState.success && (
        <p role="alert" className="text-sm text-destructive">
          {createState.message}
        </p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.fullName}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.roleName}</TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "secondary"}>
                    {user.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUpdateState(initialState);
                      setEditing(user);
                    }}
                  >
                    Ubah
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  Belum ada pengguna
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah pengguna</DialogTitle>
            <DialogDescription>
              Buat akun baru beserta role-nya
            </DialogDescription>
          </DialogHeader>
          <form action={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="create-fullName" className="text-sm font-medium">
                Nama lengkap
              </label>
              <Input
                id="create-fullName"
                name="fullName"
                required
                disabled={createPending}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="create-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="create-email"
                name="email"
                type="email"
                required
                disabled={createPending}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="create-password" className="text-sm font-medium">
                Kata sandi
              </label>
              <Input
                id="create-password"
                name="password"
                type="password"
                minLength={6}
                required
                disabled={createPending}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="create-role" className="text-sm font-medium">
                Role
              </label>
              <RoleSelect
                roles={roles}
                disabled={createPending}
                id="create-role"
              />
            </div>
            {createState.message && (
              <p
                role="alert"
                className={`text-sm ${createState.success ? "text-green-600" : "text-destructive"}`}
              >
                {createState.message}
              </p>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={createPending}
                loading={createPending}
              >
                {createPending ? "Menyimpan..." : "Simpan"}
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
            <DialogTitle>Ubah pengguna</DialogTitle>
            <DialogDescription>
              Perbarui nama, role, atau status akun
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              action={handleUpdate}
              className="flex flex-col gap-4"
              key={editing.id}
            >
              <input type="hidden" name="userId" value={editing.id} />
              <div className="flex flex-col gap-2">
                <label htmlFor="edit-fullName" className="text-sm font-medium">
                  Nama lengkap
                </label>
                <Input
                  id="edit-fullName"
                  name="fullName"
                  defaultValue={editing.fullName}
                  required
                  disabled={updatePending}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="edit-role" className="text-sm font-medium">
                  Role
                </label>
                <RoleSelect
                  roles={roles}
                  defaultValue={editing.roleId}
                  disabled={updatePending}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="edit-pin" className="text-sm font-medium">
                  PIN kasir{" "}
                  <span className="font-normal text-muted-foreground">
                    (4-6 digit, kosongkan bila tidak diubah)
                  </span>
                </label>
                <Input
                  id="edit-pin"
                  name="pin"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={updatePending}
                  placeholder="••••"
                  className="min-h-11 max-w-40"
                />
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={editing.isActive}
                  disabled={updatePending || editing.id === currentUserId}
                  className="size-4"
                />
                {editing.id !== currentUserId && (
                  <input type="hidden" name="isActivePresent" value="1" />
                )}
                Akun aktif
                {editing.id === currentUserId && (
                  <span className="text-xs font-normal text-muted-foreground">
                    (tidak dapat menonaktifkan akun sendiri)
                  </span>
                )}
              </label>
              {updateState.message && (
                <p
                  role="alert"
                  className={`text-sm ${updateState.success ? "text-green-600" : "text-destructive"}`}
                >
                  {updateState.message}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updatePending}
                  loading={updatePending}
                >
                  {updatePending ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

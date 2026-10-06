"use server";

import { revalidatePath } from "next/cache";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";

export interface RoleDTO {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface PermissionDTO {
  code: string;
  description: string;
}

export interface RoleActionState {
  success: boolean;
  message: string | null;
}

const INITIAL: RoleActionState = { success: false, message: null };

async function guardRole(): Promise<null | RoleActionState> {
  const result = await requirePermission("role.manage");
  if (!result.ok) {
    return { ...INITIAL, message: result.message };
  }
  return null;
}

export async function listRolesAction(): Promise<{
  roles: RoleDTO[];
  permissions: PermissionDTO[];
}> {
  const denied = await guardRole();
  if (denied) {
    return { roles: [], permissions: [] };
  }
  const container = await getAppContainer();
  const [rolesResult, permsResult, usersResult] = await Promise.all([
    container.iam.listRoles.execute(),
    container.iam.listPermissions.execute(),
    container.iam.listUsers.execute(),
  ]);
  if (isErr(rolesResult) || isErr(permsResult) || isErr(usersResult)) {
    return { roles: [], permissions: [] };
  }
  const countByRole = new Map<string, number>();
  for (const user of usersResult.data) {
    countByRole.set(user.roleId, (countByRole.get(user.roleId) ?? 0) + 1);
  }
  return {
    roles: rolesResult.data.map((role) => ({
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      permissions: role.permissions,
      userCount: countByRole.get(role.id) ?? 0,
    })),
    permissions: permsResult.data.map((p) => ({
      code: p.code,
      description: p.description,
    })),
  };
}

export async function createRoleAction(
  _prevState: RoleActionState,
  formData: FormData
): Promise<RoleActionState> {
  const denied = await guardRole();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.iam.createRole.execute({
    name: String(formData.get("name") ?? "").trim(),
    permissionCodes: formData.getAll("permissions").map(String),
  });
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/pengaturan/roles");
  return {
    success: true,
    message: `Role "${result.data.name}" berhasil dibuat`,
  };
}

export async function updateRoleAction(
  _prevState: RoleActionState,
  formData: FormData
): Promise<RoleActionState> {
  const denied = await guardRole();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.iam.updateRole.execute(
    String(formData.get("roleId") ?? ""),
    {
      name: String(formData.get("name") ?? "").trim(),
      permissionCodes: formData.getAll("permissions").map(String),
    }
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/pengaturan/roles");
  return {
    success: true,
    message: `Role "${result.data.name}" berhasil diperbarui`,
  };
}

export async function deleteRoleAction(
  roleId: string
): Promise<RoleActionState> {
  const denied = await guardRole();
  if (denied) {
    return denied;
  }
  const container = await getAppContainer();
  const result = await container.iam.deleteRole.execute(roleId);
  if (isErr(result)) {
    return { success: false, message: result.error.message };
  }
  revalidatePath("/pengaturan/roles");
  return { success: true, message: "Role berhasil dihapus" };
}

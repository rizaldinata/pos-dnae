import { User } from "@/modules/iam/domain/entities/user";
import { Role } from "@/modules/iam/domain/entities/role";

export interface ProfileRow {
  id: string;
  role_id: string | null;
  full_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  roles: {
    id: string;
    name: string;
    is_system: boolean;
    role_permissions: {
      permissions: { code: string } | null;
    }[];
  } | null;
}

export interface RoleRow {
  id: string;
  name: string;
  is_system: boolean;
  created_at: string;
  role_permissions: {
    permissions: { code: string } | null;
  }[];
}

export function mapProfileRowToUser(row: ProfileRow, email: string): User {
  const permissions = (row.roles?.role_permissions ?? [])
    .map((rp) => rp.permissions?.code)
    .filter((code): code is string => typeof code === "string");

  return User.create(
    {
      email,
      fullName: row.full_name,
      roleId: row.role_id ?? "",
      roleName: row.roles?.name ?? "-",
      permissions,
      isActive: row.is_active,
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }
  );
}

export function mapRoleRowToRole(row: RoleRow): Role {
  const permissions = (row.role_permissions ?? [])
    .map((rp) => rp.permissions?.code)
    .filter((code): code is string => typeof code === "string");

  return Role.create(
    { name: row.name, isSystem: row.is_system, permissions },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.created_at) }
  );
}

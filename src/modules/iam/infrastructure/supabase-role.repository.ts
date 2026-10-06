import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type { IRoleRepository } from "@/modules/iam/domain/repositories/role.repository";
import {
  mapRoleRowToRole,
  type RoleRow,
} from "@/modules/iam/infrastructure/mappers/user.mapper";
import { Permission } from "@/modules/iam/domain/entities/permission";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";
import type { Role } from "@/modules/iam/domain/entities/role";

const ROLE_SELECT = `
  id,
  name,
  is_system,
  created_at,
  role_permissions (
    permissions ( code )
  )
`;

export class SupabaseRoleRepository implements IRoleRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async findById(id: string): Promise<Result<Role | null, DomainError>> {
    const { data, error } = await this.client
      .from("roles")
      .select(ROLE_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapRoleRowToRole(data as unknown as RoleRow));
  }

  public async findAll(): Promise<Result<Role[], DomainError>> {
    const { data, error } = await this.client
      .from("roles")
      .select(ROLE_SELECT)
      .order("name", { ascending: true });

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(((data ?? []) as unknown as RoleRow[]).map(mapRoleRowToRole));
  }

  public async findAllPermissions(): Promise<
    Result<Permission[], DomainError>
  > {
    const { data, error } = await this.client
      .from("permissions")
      .select("id,code,description")
      .order("code", { ascending: true });

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(
      ((data ?? []) as { id: string; code: string; description: string }[]).map(
        (row) =>
          Permission.create(
            { code: row.code, description: row.description },
            row.id
          )
      )
    );
  }

  private async syncPermissions(
    roleId: string,
    codes: string[]
  ): Promise<Result<void, DomainError>> {
    const { data: permissions, error: permissionError } = await this.client
      .from("permissions")
      .select("id,code")
      .in("code", codes.length > 0 ? codes : ["__none__"]);

    if (permissionError) {
      return err(
        new InvariantViolationError(
          `Database error: ${permissionError.message}`
        )
      );
    }

    const { error: deleteError } = await this.client
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    if (deleteError) {
      return err(
        new InvariantViolationError(`Database error: ${deleteError.message}`)
      );
    }

    const rows = ((permissions ?? []) as { id: string; code: string }[]).map(
      (p) => ({ role_id: roleId, permission_id: p.id })
    );

    if (rows.length > 0) {
      const { error: insertError } = await this.client
        .from("role_permissions")
        .insert(rows);

      if (insertError) {
        return err(
          new InvariantViolationError(`Database error: ${insertError.message}`)
        );
      }
    }

    return ok(undefined);
  }

  public async create(
    name: string,
    permissionCodes: string[]
  ): Promise<Result<Role, DomainError>> {
    const { data, error } = await this.client
      .from("roles")
      .insert({ name, is_system: false })
      .select("id")
      .single();

    if (error || !data) {
      return err(
        new InvariantViolationError(
          `Database error: ${error?.message ?? "unknown"}`
        )
      );
    }

    const roleId = (data as { id: string }).id;
    const synced = await this.syncPermissions(roleId, permissionCodes);
    if (!synced.success) {
      return err(synced.error);
    }

    const created = await this.findById(roleId);
    if (!created.success) {
      return err(created.error);
    }
    if (created.data === null) {
      return err(new InvariantViolationError("Role gagal dimuat"));
    }
    return ok(created.data);
  }

  public async update(
    id: string,
    patch: { name?: string; permissionCodes?: string[] }
  ): Promise<Result<Role, DomainError>> {
    if (patch.name !== undefined) {
      const { error } = await this.client
        .from("roles")
        .update({ name: patch.name })
        .eq("id", id);

      if (error) {
        return err(
          new InvariantViolationError(`Database error: ${error.message}`)
        );
      }
    }

    if (patch.permissionCodes !== undefined) {
      const synced = await this.syncPermissions(id, patch.permissionCodes);
      if (!synced.success) {
        return err(synced.error);
      }
    }

    const updated = await this.findById(id);
    if (!updated.success) {
      return err(updated.error);
    }
    if (updated.data === null) {
      return err(new InvariantViolationError("Role gagal dimuat"));
    }
    return ok(updated.data);
  }

  public async remove(id: string): Promise<Result<void, DomainError>> {
    const { error: mappingError } = await this.client
      .from("role_permissions")
      .delete()
      .eq("role_id", id);

    if (mappingError) {
      return err(
        new InvariantViolationError(`Database error: ${mappingError.message}`)
      );
    }

    const { error } = await this.client.from("roles").delete().eq("id", id);

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(undefined);
  }

  public async countUsersByRole(
    roleId: string
  ): Promise<Result<number, DomainError>> {
    const { count, error } = await this.client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role_id", roleId);

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(count ?? 0);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type { IRoleRepository } from "@/modules/iam/domain/repositories/role.repository";
import {
  mapRoleRowToRole,
  type RoleRow,
} from "@/modules/iam/infrastructure/mappers/user.mapper";
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
}

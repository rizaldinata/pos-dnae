import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  CreateUserRecord,
  IUserRepository,
  UpdateUserRecord,
} from "@/modules/iam/domain/repositories/user.repository";
import { User } from "@/modules/iam/domain/entities/user";
import { EmailAlreadyExistsError } from "@/modules/iam/domain/errors";
import {
  mapProfileRowToUser,
  type ProfileRow,
} from "@/modules/iam/infrastructure/mappers/user.mapper";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  NotFoundError,
  type DomainError,
} from "@/shared/kernel/errors";

const PROFILE_SELECT = `
  id,
  role_id,
  full_name,
  is_active,
  created_at,
  updated_at,
  roles (
    id,
    name,
    is_system,
    role_permissions (
      permissions ( code )
    )
  )
`;

export class SupabaseUserRepository implements IUserRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly adminClient: SupabaseClient<Database>
  ) {}

  private toDomainError(error: { message: string }): DomainError {
    return new InvariantViolationError(`Database error: ${error.message}`);
  }

  private async findProfileById(
    id: string
  ): Promise<Result<ProfileRow | null, DomainError>> {
    const { data, error } = await this.client
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return err(this.toDomainError(error));
    }
    if (data === null) {
      return ok(null);
    }
    return ok(data as unknown as ProfileRow);
  }

  public async findById(id: string): Promise<Result<User | null, DomainError>> {
    const profileResult = await this.findProfileById(id);
    if (profileResult.success === false) {
      return err(profileResult.error);
    }
    if (profileResult.data === null) {
      return ok(null);
    }

    const { data: authUser, error: authError } =
      await this.adminClient.auth.admin.getUserById(id);
    const email = authError ? "" : (authUser.user.email ?? "");
    return ok(mapProfileRowToUser(profileResult.data, email));
  }

  public async findByEmail(
    email: string
  ): Promise<Result<User | null, DomainError>> {
    const { data: list, error: listError } =
      await this.adminClient.auth.admin.listUsers();
    if (listError) {
      return err(this.toDomainError(listError));
    }
    const match = list.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (!match) {
      return ok(null);
    }
    return this.findById(match.id);
  }

  public async findAll(): Promise<Result<User[], DomainError>> {
    const { data, error } = await this.client
      .from("profiles")
      .select(PROFILE_SELECT)
      .order("created_at", { ascending: true });

    if (error) {
      return err(this.toDomainError(error));
    }

    const rows = (data ?? []) as unknown as ProfileRow[];
    const { data: list, error: listError } =
      await this.adminClient.auth.admin.listUsers();
    if (listError) {
      return err(this.toDomainError(listError));
    }
    const emailById = new Map(
      list.users.map((u) => [u.id, u.email ?? ""] as const)
    );

    return ok(
      rows.map((row) => mapProfileRowToUser(row, emailById.get(row.id) ?? ""))
    );
  }

  public async create(
    record: CreateUserRecord
  ): Promise<Result<User, DomainError>> {
    const { data: created, error: createError } =
      await this.adminClient.auth.admin.createUser({
        email: record.email,
        password: record.password,
        email_confirm: true,
        user_metadata: { full_name: record.fullName },
      });

    if (createError || !created.user) {
      if (createError?.message.toLowerCase().includes("already")) {
        return err(new EmailAlreadyExistsError(record.email));
      }
      return err(
        this.toDomainError({
          message: createError?.message ?? "Gagal membuat user",
        })
      );
    }

    const userId = created.user.id;
    const { error: profileError } = await this.adminClient
      .from("profiles")
      .insert({
        id: userId,
        role_id: record.roleId,
        full_name: record.fullName,
        is_active: true,
      });

    if (profileError) {
      await this.adminClient.auth.admin.deleteUser(userId);
      return err(this.toDomainError(profileError));
    }

    const created2 = await this.findById(userId);
    if (created2.success === false) {
      return err(created2.error);
    }
    if (created2.data === null) {
      return err(new NotFoundError("Pengguna", userId));
    }
    return ok(created2.data);
  }

  public async update(
    id: string,
    patch: UpdateUserRecord
  ): Promise<Result<User, DomainError>> {
    const payload: {
      full_name?: string;
      role_id?: string;
      is_active?: boolean;
    } = {};
    if (patch.fullName !== undefined) {
      payload.full_name = patch.fullName;
    }
    if (patch.roleId !== undefined) {
      payload.role_id = patch.roleId;
    }
    if (patch.isActive !== undefined) {
      payload.is_active = patch.isActive;
    }

    if (Object.keys(payload).length > 0) {
      const { error } = await this.client
        .from("profiles")
        .update(payload)
        .eq("id", id);
      if (error) {
        return err(this.toDomainError(error));
      }
    }

    const updated = await this.findById(id);
    if (updated.success === false) {
      return err(updated.error);
    }
    if (updated.data === null) {
      return err(new NotFoundError("Pengguna", id));
    }
    return ok(updated.data);
  }
}

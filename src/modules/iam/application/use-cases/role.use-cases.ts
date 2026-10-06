import { z } from "zod";
import type { IRoleRepository } from "@/modules/iam/domain/repositories/role.repository";
import type { Permission } from "@/modules/iam/domain/entities/permission";
import type { Role } from "@/modules/iam/domain/entities/role";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";

export const RoleInputSchema = z.object({
  name: z
    .string({ error: "Nama role wajib diisi" })
    .trim()
    .min(1, { error: "Nama role wajib diisi" })
    .max(50, { error: "Nama maksimal 50 karakter" }),
  permissionCodes: z.array(z.string()).optional().default([]),
});

export type RoleInput = z.input<typeof RoleInputSchema>;

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

async function resolvePermissionCodes(
  roles: IRoleRepository,
  codes: string[]
): Promise<Result<string[], DomainError>> {
  const all = await roles.findAllPermissions();
  if (isErr(all)) {
    return err(all.error);
  }
  const known = new Set(all.data.map((p) => p.code));
  const unknown = [...new Set(codes)].filter((code) => !known.has(code));
  if (unknown.length > 0) {
    return err(
      new ValidationError(`Permission tidak dikenal: ${unknown.join(", ")}`)
    );
  }
  return ok([...new Set(codes)]);
}

export class CreateRoleUseCase {
  constructor(private readonly roles: IRoleRepository) {}

  public async execute(
    rawInput: RoleInput
  ): Promise<Result<Role, DomainError>> {
    const parsed = RoleInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data role tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const codes = await resolvePermissionCodes(
      this.roles,
      parsed.data.permissionCodes
    );
    if (isErr(codes)) {
      return err(codes.error);
    }
    return this.roles.create(parsed.data.name, codes.data);
  }
}

export class UpdateRoleUseCase {
  constructor(private readonly roles: IRoleRepository) {}

  public async execute(
    id: string,
    rawInput: Partial<RoleInput>
  ): Promise<Result<Role, DomainError>> {
    const parsed = RoleInputSchema.partial().safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data role tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await this.roles.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Role", id));
    }
    let codes: string[] | undefined;
    if (parsed.data.permissionCodes !== undefined) {
      const resolved = await resolvePermissionCodes(
        this.roles,
        parsed.data.permissionCodes
      );
      if (isErr(resolved)) {
        return err(resolved.error);
      }
      codes = resolved.data;
    }
    return this.roles.update(id, {
      name: parsed.data.name,
      permissionCodes: codes,
    });
  }
}

export class DeleteRoleUseCase {
  constructor(private readonly roles: IRoleRepository) {}

  public async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.roles.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Role", id));
    }
    if (existing.data.isSystem) {
      return err(new ValidationError("Role sistem tidak dapat dihapus"));
    }
    const counted = await this.roles.countUsersByRole(id);
    if (isErr(counted)) {
      return err(counted.error);
    }
    if (counted.data > 0) {
      return err(
        new ValidationError(`Role masih dipakai ${counted.data} pengguna`)
      );
    }
    return this.roles.remove(id);
  }
}

export class ListPermissionsUseCase {
  constructor(private readonly roles: IRoleRepository) {}

  public async execute(): Promise<Result<Permission[], DomainError>> {
    return this.roles.findAllPermissions();
  }
}

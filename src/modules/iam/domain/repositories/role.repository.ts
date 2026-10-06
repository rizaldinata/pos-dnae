import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { Role } from "@/modules/iam/domain/entities/role";
import type { Permission } from "@/modules/iam/domain/entities/permission";

export interface IRoleRepository {
  findById(id: string): Promise<Result<Role | null, DomainError>>;
  findAll(): Promise<Result<Role[], DomainError>>;
  findAllPermissions(): Promise<Result<Permission[], DomainError>>;
  create(
    name: string,
    permissionCodes: string[]
  ): Promise<Result<Role, DomainError>>;
  update(
    id: string,
    patch: { name?: string; permissionCodes?: string[] }
  ): Promise<Result<Role, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
  countUsersByRole(roleId: string): Promise<Result<number, DomainError>>;
}

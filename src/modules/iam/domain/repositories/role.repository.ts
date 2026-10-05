import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { Role } from "@/modules/iam/domain/entities/role";

export interface IRoleRepository {
  findById(id: string): Promise<Result<Role | null, DomainError>>;
  findAll(): Promise<Result<Role[], DomainError>>;
}

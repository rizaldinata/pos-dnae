import type { IRoleRepository } from "@/modules/iam/domain/repositories/role.repository";
import type { Role } from "@/modules/iam/domain/entities/role";
import { isErr, type Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export class ListRolesUseCase {
  constructor(private readonly roles: IRoleRepository) {}

  public async execute(): Promise<Result<Role[], DomainError>> {
    const result = await this.roles.findAll();
    if (isErr(result)) {
      return result;
    }
    return result;
  }
}

import type { IUserRepository } from "@/modules/iam/domain/repositories/user.repository";
import type { User } from "@/modules/iam/domain/entities/user";
import { isErr, type Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export class ListUsersUseCase {
  constructor(private readonly users: IUserRepository) {}

  public async execute(): Promise<Result<User[], DomainError>> {
    const result = await this.users.findAll();
    if (isErr(result)) {
      return result;
    }
    return result;
  }
}

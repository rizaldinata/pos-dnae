import type { IUserRepository } from "@/modules/iam/domain/repositories/user.repository";
import type { IRoleRepository } from "@/modules/iam/domain/repositories/role.repository";
import type { CreateUserInput } from "@/modules/iam/application/dto/user.dto";
import { CreateUserSchema } from "@/modules/iam/application/dto/user.dto";
import type { User } from "@/modules/iam/domain/entities/user";
import { EmailAlreadyExistsError } from "@/modules/iam/domain/errors";
import { NotFoundError } from "@/shared/kernel/errors";
import { err, isErr, isOk, type Result } from "@/shared/kernel/result";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";

export class CreateUserUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly roles: IRoleRepository
  ) {}

  public async execute(
    rawInput: CreateUserInput
  ): Promise<Result<User, DomainError>> {
    const parsed = CreateUserSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return err(new ValidationError("Data pengguna tidak valid", fieldErrors));
    }

    const roleResult = await this.roles.findById(parsed.data.roleId);
    if (isErr(roleResult)) {
      return err(roleResult.error);
    }
    if (roleResult.data === null) {
      return err(new NotFoundError("Role", parsed.data.roleId));
    }

    const existingResult = await this.users.findByEmail(parsed.data.email);
    if (isOk(existingResult) && existingResult.data !== null) {
      return err(new EmailAlreadyExistsError(parsed.data.email));
    }
    if (isErr(existingResult)) {
      return err(existingResult.error);
    }

    return this.users.create({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
      roleId: parsed.data.roleId,
    });
  }
}

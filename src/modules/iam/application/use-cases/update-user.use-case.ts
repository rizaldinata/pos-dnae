import type { IUserRepository } from "@/modules/iam/domain/repositories/user.repository";
import type { IRoleRepository } from "@/modules/iam/domain/repositories/role.repository";
import type { UpdateUserInput } from "@/modules/iam/application/dto/user.dto";
import { UpdateUserSchema } from "@/modules/iam/application/dto/user.dto";
import type { User } from "@/modules/iam/domain/entities/user";
import {
  CannotDeactivateSelfError,
  UserNotFoundError,
} from "@/modules/iam/domain/errors";
import { NotFoundError } from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";

export interface UpdateUserRequest extends UpdateUserInput {
  actorId: string;
}

export class UpdateUserUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly roles: IRoleRepository
  ) {}

  public async execute(
    userId: string,
    rawInput: UpdateUserRequest
  ): Promise<Result<User, DomainError>> {
    const parsed = UpdateUserSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return err(new ValidationError("Data pengguna tidak valid", fieldErrors));
    }

    if (rawInput.actorId === userId && parsed.data.isActive === false) {
      return err(new CannotDeactivateSelfError());
    }

    const existingResult = await this.users.findById(userId);
    if (isErr(existingResult)) {
      return err(existingResult.error);
    }
    if (existingResult.data === null) {
      return err(new UserNotFoundError(userId));
    }

    if (parsed.data.roleId !== undefined) {
      const roleResult = await this.roles.findById(parsed.data.roleId);
      if (isErr(roleResult)) {
        return err(roleResult.error);
      }
      if (roleResult.data === null) {
        return err(new NotFoundError("Role", parsed.data.roleId));
      }
    }

    const updateResult = await this.users.update(userId, {
      fullName: parsed.data.fullName,
      roleId: parsed.data.roleId,
      isActive: parsed.data.isActive,
    });
    if (isErr(updateResult)) {
      return err(updateResult.error);
    }
    return ok(updateResult.data);
  }
}

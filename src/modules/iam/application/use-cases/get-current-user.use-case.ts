import type { IUserRepository } from "@/modules/iam/domain/repositories/user.repository";
import type { IAuthService } from "@/modules/iam/application/ports/auth-service.port";
import type { User } from "@/modules/iam/domain/entities/user";
import {
  UserInactiveError,
  UserNotFoundError,
} from "@/modules/iam/domain/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export class GetCurrentUserUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly auth: IAuthService
  ) {}

  public async execute(): Promise<Result<User | null, DomainError>> {
    const identityResult = await this.auth.getCurrentIdentity();
    if (isErr(identityResult)) {
      return err(identityResult.error);
    }
    if (identityResult.data === null) {
      return ok(null);
    }

    const userResult = await this.users.findById(identityResult.data.userId);
    if (isErr(userResult)) {
      return err(userResult.error);
    }
    if (userResult.data === null) {
      return err(new UserNotFoundError(identityResult.data.userId));
    }
    if (!userResult.data.canLogin()) {
      return err(new UserInactiveError());
    }
    return ok(userResult.data);
  }
}

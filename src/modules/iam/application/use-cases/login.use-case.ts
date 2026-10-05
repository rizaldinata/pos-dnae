import type { IUserRepository } from "@/modules/iam/domain/repositories/user.repository";
import type { IAuthService } from "@/modules/iam/application/ports/auth-service.port";
import type { LoginInput } from "@/modules/iam/application/dto/user.dto";
import { LoginSchema } from "@/modules/iam/application/dto/user.dto";
import type { User } from "@/modules/iam/domain/entities/user";
import {
  InvalidCredentialsError,
  UserInactiveError,
  UserNotFoundError,
} from "@/modules/iam/domain/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";

export class LoginUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly auth: IAuthService
  ) {}

  public async execute(
    rawInput: LoginInput
  ): Promise<Result<User, DomainError>> {
    const parsed = LoginSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return err(new ValidationError("Login tidak valid", fieldErrors));
    }

    const signInResult = await this.auth.signIn(
      parsed.data.email,
      parsed.data.password
    );
    if (isErr(signInResult)) {
      return err(new InvalidCredentialsError());
    }

    const userResult = await this.users.findById(signInResult.data.userId);
    if (isErr(userResult)) {
      await this.auth.signOut();
      return err(userResult.error);
    }
    if (userResult.data === null) {
      await this.auth.signOut();
      return err(new UserNotFoundError(signInResult.data.userId));
    }

    const user = userResult.data;
    if (!user.canLogin()) {
      await this.auth.signOut();
      return err(new UserInactiveError());
    }

    return ok(user);
  }
}

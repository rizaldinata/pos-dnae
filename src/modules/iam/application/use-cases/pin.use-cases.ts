import { z } from "zod";
import type { IUserRepository } from "@/modules/iam/domain/repositories/user.repository";
import type {
  IAuthService,
  PinUserSummary,
} from "@/modules/iam/application/ports/auth-service.port";
import type { User } from "@/modules/iam/domain/entities/user";
import {
  hashPin,
  isValidPinFormat,
} from "@/modules/iam/domain/services/pin-hash";
import {
  UserInactiveError,
  UserNotFoundError,
} from "@/modules/iam/domain/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";

export const SetPinSchema = z.object({
  pin: z
    .string({ error: "PIN wajib diisi" })
    .regex(/^\d{4,6}$/, { error: "PIN harus 4-6 digit angka" }),
});

export class SetPinUseCase {
  constructor(private readonly users: IUserRepository) {}

  public async execute(
    userId: string,
    rawPin: string
  ): Promise<Result<void, DomainError>> {
    if (!isValidPinFormat(rawPin)) {
      return err(new ValidationError("PIN harus 4-6 digit angka"));
    }
    const existing = await this.users.findById(userId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Pengguna", userId));
    }
    let hashed: string;
    try {
      hashed = hashPin(rawPin);
    } catch {
      return err(new ValidationError("PIN harus 4-6 digit angka"));
    }
    return this.users.setPinHash(userId, hashed);
  }
}

export class LoginWithPinUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly auth: IAuthService
  ) {}

  public async execute(
    userId: string,
    pin: string
  ): Promise<Result<User, DomainError>> {
    if (!userId) {
      return err(new ValidationError("Pengguna wajib dipilih"));
    }
    const signInResult = await this.auth.signInWithPin(userId, pin);
    if (isErr(signInResult)) {
      return err(signInResult.error);
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
    if (!userResult.data.canLogin()) {
      await this.auth.signOut();
      return err(new UserInactiveError());
    }
    return ok(userResult.data);
  }
}

export class ListPinUsersUseCase {
  constructor(private readonly auth: IAuthService) {}

  public async execute(): Promise<Result<PinUserSummary[], DomainError>> {
    return this.auth.listPinUsers();
  }
}

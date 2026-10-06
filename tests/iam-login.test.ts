import { describe, expect, it } from "vitest";
import { LoginUseCase } from "@/modules/iam/application/use-cases/login.use-case";
import type { IUserRepository } from "@/modules/iam/domain/repositories/user.repository";
import type { IAuthService } from "@/modules/iam/application/ports/auth-service.port";
import { User } from "@/modules/iam/domain/entities/user";
import {
  InvalidCredentialsError,
  UserInactiveError,
} from "@/modules/iam/domain/errors";
import { err, ok } from "@/shared/kernel/result";
import { InvariantViolationError } from "@/shared/kernel/errors";

function makeUser(
  overrides?: Partial<{ id: string; isActive: boolean }>
): User {
  return User.create(
    {
      email: "kasir@pos.local",
      fullName: "Kasir",
      roleId: "role-kasir",
      roleName: "Kasir",
      permissions: ["sale.create"],
      isActive: overrides?.isActive ?? true,
    },
    overrides?.id ?? "user-1"
  );
}

describe("LoginUseCase", () => {
  function setup(users: { byId: Record<string, User> }, passwordOk: boolean) {
    const userRepository: IUserRepository = {
      findById: async (id) => ok(users.byId[id] ?? null),
      findByEmail: async () => ok(null),
      findAll: async () => ok([]),
      create: async () => err(new InvariantViolationError("not used")),
      update: async () => err(new InvariantViolationError("not used")),
      setPinHash: async () => ok(undefined),
      recordPinFailure: async () => ok({ attempts: 0, lockedUntil: null }),
      resetPinAttempts: async () => ok(undefined),
      getPinStatus: async () =>
        ok({ pinSet: false, attempts: 0, lockedUntil: null, isActive: true }),
    };
    let signedOut = false;
    const authService: IAuthService = {
      signIn: async () =>
        passwordOk
          ? ok({ userId: "user-1", email: "kasir@pos.local" })
          : err(new InvariantViolationError("Invalid login credentials")),
      signOut: async () => {
        signedOut = true;
        return ok(undefined);
      },
      getCurrentIdentity: async () => ok(null),
      signInWithPin: async () => err(new InvariantViolationError("not used")),
      listPinUsers: async () => ok([]),
    };
    return {
      useCase: new LoginUseCase(userRepository, authService),
      wasSignedOut: () => signedOut,
    };
  }

  it("berhasil login untuk user aktif", async () => {
    const { useCase } = setup({ byId: { "user-1": makeUser() } }, true);
    const result = await useCase.execute({
      email: "kasir@pos.local",
      password: "rahasia",
    });
    expect(result.success).toBe(true);
  });

  it("menolak kredensial salah", async () => {
    const { useCase } = setup({ byId: {} }, false);
    const result = await useCase.execute({
      email: "kasir@pos.local",
      password: "salah",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvalidCredentialsError);
    }
  });

  it("menolak user nonaktif dan menghapus sesi", async () => {
    const { useCase, wasSignedOut } = setup(
      { byId: { "user-1": makeUser({ isActive: false }) } },
      true
    );
    const result = await useCase.execute({
      email: "kasir@pos.local",
      password: "rahasia",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UserInactiveError);
    }
    expect(wasSignedOut()).toBe(true);
  });

  it("menolak input tidak valid", async () => {
    const { useCase } = setup({ byId: {} }, true);
    const result = await useCase.execute({
      email: "bukan-email",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

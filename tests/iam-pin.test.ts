import { describe, expect, it } from "vitest";
import {
  hashPin,
  isValidPinFormat,
  verifyPin,
} from "@/modules/iam/domain/services/pin-hash";
import {
  LoginWithPinUseCase,
  SetPinUseCase,
} from "@/modules/iam/application/use-cases/pin.use-cases";
import type { IUserRepository } from "@/modules/iam/domain/repositories/user.repository";
import type { IAuthService } from "@/modules/iam/application/ports/auth-service.port";
import { User } from "@/modules/iam/domain/entities/user";
import { UserInactiveError } from "@/modules/iam/domain/errors";
import { NotFoundError, ValidationError } from "@/shared/kernel/errors";
import { err, ok } from "@/shared/kernel/result";
import { InvariantViolationError } from "@/shared/kernel/errors";

describe("PIN format & hash", () => {
  it("format 4-6 digit", () => {
    expect(isValidPinFormat("1234")).toBe(true);
    expect(isValidPinFormat("123456")).toBe(true);
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("1234567")).toBe(false);
    expect(isValidPinFormat("12ab")).toBe(false);
  });

  it("hash lalu verifikasi berhasil, pin salah gagal", () => {
    const hashed = hashPin("2468");
    expect(verifyPin("2468", hashed)).toBe(true);
    expect(verifyPin("0000", hashed)).toBe(false);
    expect(verifyPin("2468", null)).toBe(false);
  });

  it("salt acak per hash", () => {
    expect(hashPin("2468")).not.toBe(hashPin("2468"));
  });

  it("menolak format salah saat hash", () => {
    expect(() => hashPin("12")).toThrow();
  });
});

function makeUser(active = true): User {
  return User.create(
    {
      email: "kasir@pos.local",
      fullName: "Kasir",
      roleId: "r-1",
      roleName: "Kasir",
      permissions: ["sale.create"],
      isActive: active,
    },
    "u-1"
  );
}

describe("SetPinUseCase", () => {
  function setup(users: User[]) {
    const repo: IUserRepository = {
      findById: async (id) => ok(users.find((u) => u.id === id) ?? null),
      findByEmail: async () => ok(null),
      findAll: async () => ok(users),
      create: async () => err(new InvariantViolationError("not used")),
      update: async () => err(new InvariantViolationError("not used")),
      setPinHash: async () => ok(undefined),
      recordPinFailure: async () => ok({ attempts: 0, lockedUntil: null }),
      resetPinAttempts: async () => ok(undefined),
      getPinStatus: async () =>
        ok({ pinSet: false, attempts: 0, lockedUntil: null, isActive: true }),
    };
    return new SetPinUseCase(repo);
  }

  it("mengatur PIN valid", async () => {
    const result = await setup([makeUser()]).execute("u-1", "1357");
    expect(result.success).toBe(true);
  });

  it("menolak PIN bukan digit", async () => {
    const result = await setup([makeUser()]).execute("u-1", "abcd");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("menolak user tidak ada", async () => {
    const result = await setup([]).execute("u-x", "1357");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});

describe("LoginWithPinUseCase", () => {
  function setup(user: User | null, signIn: "ok" | "wrong" | "locked") {
    const repo: IUserRepository = {
      findById: async () => ok(user),
      findByEmail: async () => ok(null),
      findAll: async () => ok(user ? [user] : []),
      create: async () => err(new InvariantViolationError("not used")),
      update: async () => err(new InvariantViolationError("not used")),
      setPinHash: async () => ok(undefined),
      recordPinFailure: async () => ok({ attempts: 0, lockedUntil: null }),
      resetPinAttempts: async () => ok(undefined),
      getPinStatus: async () =>
        ok({ pinSet: false, attempts: 0, lockedUntil: null, isActive: true }),
    };
    const auth: IAuthService = {
      signIn: async () => err(new InvariantViolationError("not used")),
      signOut: async () => ok(undefined),
      getCurrentIdentity: async () => ok(null),
      signInWithPin: async () =>
        signIn === "ok"
          ? ok({ userId: "u-1", email: "kasir@pos.local" })
          : err(
              new InvariantViolationError(
                signIn === "locked" ? "terkunci" : "PIN salah"
              )
            ),
      listPinUsers: async () => ok([]),
    };
    return new LoginWithPinUseCase(repo, auth);
  }

  it("login PIN sukses", async () => {
    const result = await setup(makeUser(), "ok").execute("u-1", "1357");
    expect(result.success).toBe(true);
  });

  it("PIN salah diteruskan", async () => {
    const result = await setup(makeUser(), "wrong").execute("u-1", "0000");
    expect(result.success).toBe(false);
  });

  it("user nonaktif ditolak", async () => {
    const result = await setup(makeUser(false), "ok").execute("u-1", "1357");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UserInactiveError);
    }
  });
});

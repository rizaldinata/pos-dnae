import { describe, expect, it } from "vitest";
import { CreateUserUseCase } from "@/modules/iam/application/use-cases/create-user.use-case";
import { UpdateUserUseCase } from "@/modules/iam/application/use-cases/update-user.use-case";
import type { IUserRepository } from "@/modules/iam/domain/repositories/user.repository";
import type { IRoleRepository } from "@/modules/iam/domain/repositories/role.repository";
import { User } from "@/modules/iam/domain/entities/user";
import { Role } from "@/modules/iam/domain/entities/role";
import {
  EmailAlreadyExistsError,
  CannotDeactivateSelfError,
} from "@/modules/iam/domain/errors";
import { InvariantViolationError, NotFoundError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";

const KASIR_ROLE_ID = "20000000-0000-4000-8000-000000000001";

const kasirRole = Role.create(
  { name: "Kasir", isSystem: true, permissions: ["sale.create"] },
  KASIR_ROLE_ID
);

function setup(store: { users: User[] }) {
  const userRepository: IUserRepository = {
    findById: async (id) => ok(store.users.find((u) => u.id === id) ?? null),
    findByEmail: async (email) =>
      ok(
        store.users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        ) ?? null
      ),
    findAll: async () => ok([...store.users]),
    create: async (record) => {
      const user = User.create(
        {
          email: record.email,
          fullName: record.fullName,
          roleId: record.roleId,
          roleName: "Kasir",
          permissions: ["sale.create"],
          isActive: true,
        },
        `user-${store.users.length + 1}`
      );
      store.users.push(user);
      return ok(user);
    },
    update: async (id, patch) => {
      const existing = store.users.find((u) => u.id === id);
      if (!existing) {
        throw new Error("not found in fake");
      }
      const updated = User.create(
        {
          email: existing.email,
          fullName: patch.fullName ?? existing.fullName,
          roleId: patch.roleId ?? existing.roleId,
          roleName: existing.roleName,
          permissions: existing.permissions,
          isActive: patch.isActive ?? existing.isActive,
        },
        existing.id
      );
      store.users = store.users.map((u) => (u.id === id ? updated : u));
      return ok(updated);
    },
    setPinHash: async () => ok(undefined),
    recordPinFailure: async () => ok({ attempts: 0, lockedUntil: null }),
    resetPinAttempts: async () => ok(undefined),
    getPinStatus: async () =>
      ok({ pinSet: false, attempts: 0, lockedUntil: null, isActive: true }),
  };
  const roleRepository: IRoleRepository = {
    findById: async (id) => ok(id === kasirRole.id ? kasirRole : null),
    findAll: async () => ok([kasirRole]),
    findAllPermissions: async () => ok([]),
    create: async () => {
      throw new InvariantViolationError("not used");
    },
    update: async () => {
      throw new InvariantViolationError("not used");
    },
    remove: async () => ok(undefined),
    countUsersByRole: async () => ok(0),
  };
  return {
    createUseCase: new CreateUserUseCase(userRepository, roleRepository),
    updateUseCase: new UpdateUserUseCase(userRepository, roleRepository),
  };
}

describe("CreateUserUseCase", () => {
  it("membuat user baru dengan role valid", async () => {
    const { createUseCase } = setup({ users: [] });
    const result = await createUseCase.execute({
      email: "baru@pos.local",
      password: "rahasia123",
      fullName: "Kasir Baru",
      roleId: KASIR_ROLE_ID,
    });
    expect(result.success).toBe(true);
  });

  it("menolak email duplikat", async () => {
    const existing = User.create(
      {
        email: "ada@pos.local",
        fullName: "Ada",
        roleId: KASIR_ROLE_ID,
        roleName: "Kasir",
        permissions: [],
        isActive: true,
      },
      "user-1"
    );
    const { createUseCase } = setup({ users: [existing] });
    const result = await createUseCase.execute({
      email: "ada@pos.local",
      password: "rahasia123",
      fullName: "Duplikat",
      roleId: KASIR_ROLE_ID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(EmailAlreadyExistsError);
    }
  });

  it("menolak role yang tidak ada", async () => {
    const { createUseCase } = setup({ users: [] });
    const result = await createUseCase.execute({
      email: "baru@pos.local",
      password: "rahasia123",
      fullName: "Baru",
      roleId: "30000000-0000-4000-8000-000000000099",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});

describe("UpdateUserUseCase", () => {
  it("melarang nonaktifkan akun sendiri", async () => {
    const self = User.create(
      {
        email: "owner@pos.local",
        fullName: "Owner",
        roleId: "role-owner",
        roleName: "Owner",
        permissions: ["user.manage"],
        isActive: true,
      },
      "user-owner"
    );
    const { updateUseCase } = setup({ users: [self] });
    const result = await updateUseCase.execute("user-owner", {
      actorId: "user-owner",
      isActive: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(CannotDeactivateSelfError);
    }
  });
});

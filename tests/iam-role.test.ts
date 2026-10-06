import { describe, expect, it } from "vitest";
import {
  CreateRoleUseCase,
  DeleteRoleUseCase,
  UpdateRoleUseCase,
} from "@/modules/iam/application/use-cases/role.use-cases";
import type { IRoleRepository } from "@/modules/iam/domain/repositories/role.repository";
import { Role } from "@/modules/iam/domain/entities/role";
import { Permission } from "@/modules/iam/domain/entities/permission";
import { NotFoundError, ValidationError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";

const PERMS = [
  Permission.create({ code: "sale.create", description: "" }, "p-1"),
  Permission.create({ code: "sale.void", description: "" }, "p-2"),
];

function setup(roles: Role[], usersByRole: Record<string, number> = {}) {
  const repo: IRoleRepository = {
    findById: async (id) => ok(roles.find((r) => r.id === id) ?? null),
    findAll: async () => ok(roles),
    findAllPermissions: async () => ok(PERMS),
    create: async (name, codes) => {
      const role = Role.create(
        { name, isSystem: false, permissions: codes },
        `r-${roles.length + 1}`
      );
      roles.push(role);
      return ok(role);
    },
    update: async (id, patch) => {
      const existing = roles.find((r) => r.id === id);
      if (!existing) {
        throw new Error("not found in fake");
      }
      const updated = Role.create(
        {
          name: patch.name ?? existing.name,
          isSystem: existing.isSystem,
          permissions: patch.permissionCodes ?? existing.permissions,
        },
        existing.id
      );
      roles.splice(roles.indexOf(existing), 1, updated);
      return ok(updated);
    },
    remove: async (id) => {
      const index = roles.findIndex((r) => r.id === id);
      if (index >= 0) {
        roles.splice(index, 1);
      }
      return ok(undefined);
    },
    countUsersByRole: async (id) => ok(usersByRole[id] ?? 0),
  };
  return {
    createUseCase: new CreateRoleUseCase(repo),
    updateUseCase: new UpdateRoleUseCase(repo),
    deleteUseCase: new DeleteRoleUseCase(repo),
  };
}

const ownerRole = () =>
  Role.create(
    { name: "Owner", isSystem: true, permissions: ["sale.create"] },
    "r-owner"
  );

describe("CreateRoleUseCase", () => {
  it("membuat role dengan permission valid", async () => {
    const { createUseCase } = setup([]);
    const result = await createUseCase.execute({
      name: "Supervisor",
      permissionCodes: ["sale.create"],
    });
    expect(result.success).toBe(true);
  });

  it("menolak permission tak dikenal", async () => {
    const { createUseCase } = setup([]);
    const result = await createUseCase.execute({
      name: "X",
      permissionCodes: ["tidak.ada"],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });
});

describe("UpdateRoleUseCase", () => {
  it("mengubah permission role sistem (diizinkan)", async () => {
    const { updateUseCase } = setup([ownerRole()]);
    const result = await updateUseCase.execute("r-owner", {
      permissionCodes: ["sale.create", "sale.void"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.permissions).toContain("sale.void");
    }
  });

  it("menolak role tak ada", async () => {
    const { updateUseCase } = setup([]);
    const result = await updateUseCase.execute("r-x", { name: "X" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});

describe("DeleteRoleUseCase", () => {
  it("menolak hapus role sistem", async () => {
    const { deleteUseCase } = setup([ownerRole()]);
    const result = await deleteUseCase.execute("r-owner");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("menolak hapus role yang dipakai user", async () => {
    const custom = Role.create(
      { name: "Custom", isSystem: false, permissions: [] },
      "r-custom"
    );
    const { deleteUseCase } = setup([custom], { "r-custom": 2 });
    const result = await deleteUseCase.execute("r-custom");
    expect(result.success).toBe(false);
  });

  it("menghapus role bebas", async () => {
    const custom = Role.create(
      { name: "Custom", isSystem: false, permissions: [] },
      "r-custom"
    );
    const store = [custom];
    const { deleteUseCase } = setup(store, {});
    const result = await deleteUseCase.execute("r-custom");
    expect(result.success).toBe(true);
    expect(store).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import { ListAuditLogsUseCase } from "@/modules/settings/application/use-cases/audit.use-cases";
import type { IAuditRepository } from "@/modules/settings/domain/repositories/audit.repository";
import { ValidationError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";

describe("ListAuditLogsUseCase", () => {
  function setup() {
    const repo: IAuditRepository = {
      list: async () => ok({ items: [], total: 0, page: 1, pageSize: 20 }),
      listActions: async () => ok(["sale.void"]),
    };
    return new ListAuditLogsUseCase(repo);
  }

  it("meneruskan filter valid", async () => {
    const result = await setup().execute({ action: "sale.void", page: 1 });
    expect(result.success).toBe(true);
  });

  it("menolak tanggal salah format", async () => {
    const result = await setup().execute({ from: "05-10-2026" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });
});

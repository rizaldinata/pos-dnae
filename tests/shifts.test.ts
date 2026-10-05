import { describe, expect, it } from "vitest";
import {
  AddCashMovementUseCase,
  CloseShiftUseCase,
  OpenShiftUseCase,
} from "@/modules/shifts/application/use-cases/shift.use-cases";
import type { IShiftRepository } from "@/modules/shifts/domain/repositories/shift.repository";
import { Shift, CashMovement } from "@/modules/shifts/domain/entities/shift";
import { Money } from "@/shared/lib/money";
import {
  NotShiftOwnerError,
  ShiftAlreadyOpenError,
  ShiftNotFoundError,
} from "@/modules/shifts/domain/errors";
import { ValidationError } from "@/shared/kernel/errors";
import { err, ok } from "@/shared/kernel/result";
import { InvariantViolationError } from "@/shared/kernel/errors";

function makeShift(
  id: string,
  userId: string,
  status: "open" | "closed"
): Shift {
  return Shift.create(
    {
      userId,
      openedAt: new Date(),
      closedAt: status === "closed" ? new Date() : null,
      openingCash: Money.create(50000),
      expectedCash: null,
      closingCash: null,
      difference: null,
      status,
    },
    id
  );
}

describe("OpenShiftUseCase", () => {
  function setup(existing: Shift | null, failOpen = false) {
    const repo: IShiftRepository = {
      openShift: async (record) => {
        if (failOpen) {
          return err(new ShiftAlreadyOpenError());
        }
        return ok(makeShift("shift-baru", record.userId, "open"));
      },
      getCurrentShift: async () => ok(existing),
      findById: async () => ok(existing),
      closeShift: async () => {
        throw new InvariantViolationError("not used");
      },
      getSummary: async () => {
        throw new InvariantViolationError("not used");
      },
      addCashMovement: async () => {
        throw new InvariantViolationError("not used");
      },
      listShifts: async () =>
        ok({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    return new OpenShiftUseCase(repo);
  }

  it("membuka shift dengan modal valid", async () => {
    const result = await setup(null).execute("u-1", { openingCash: 50000 });
    expect(result.success).toBe(true);
  });

  it("menolak modal negatif", async () => {
    const result = await setup(null).execute("u-1", { openingCash: -100 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("meneruskan error shift ganda dari repository", async () => {
    const result = await setup(makeShift("s-1", "u-1", "open"), true).execute(
      "u-1",
      { openingCash: 10000 }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ShiftAlreadyOpenError);
    }
  });
});

describe("CloseShiftUseCase", () => {
  function setup(shift: Shift | null) {
    const repo: IShiftRepository = {
      openShift: async () => {
        throw new InvariantViolationError("not used");
      },
      getCurrentShift: async () => ok(shift),
      findById: async () => ok(shift),
      closeShift: async (record) =>
        ok({
          shift: makeShift(record.shiftId, "u-1", "closed"),
          transactions: 0,
          cashSales: Money.create(0),
          cashIn: Money.create(0),
          cashOut: Money.create(0),
          changeGiven: Money.create(0),
          refundsCash: Money.create(0),
          expectedCash: Money.create(50000),
          closingCash: Money.create(record.closingCash),
          difference: Money.create(record.closingCash - 50000),
          byMethod: [],
        }),
      getSummary: async () => {
        throw new InvariantViolationError("not used");
      },
      addCashMovement: async () => {
        throw new InvariantViolationError("not used");
      },
      listShifts: async () =>
        ok({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    return new CloseShiftUseCase(repo);
  }

  it("pemilik menutup shift dan mendapat selisih", async () => {
    const result = await setup(makeShift("s-1", "u-1", "open")).execute(
      { userId: "u-1", canManageAll: false },
      "s-1",
      { closingCash: 48000 }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.difference?.amount).toBe(-2000);
    }
  });

  it("bukan pemilik tanpa hak ditolak", async () => {
    const result = await setup(makeShift("s-1", "u-1", "open")).execute(
      { userId: "u-2", canManageAll: false },
      "s-1",
      { closingCash: 50000 }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotShiftOwnerError);
    }
  });

  it("shift tidak ada ditolak", async () => {
    const result = await setup(null).execute(
      { userId: "u-1", canManageAll: true },
      "s-x",
      {
        closingCash: 0,
      }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ShiftNotFoundError);
    }
  });
});

describe("AddCashMovementUseCase", () => {
  function setup(shift: Shift | null) {
    const repo: IShiftRepository = {
      openShift: async () => {
        throw new InvariantViolationError("not used");
      },
      getCurrentShift: async () => ok(shift),
      findById: async () => ok(shift),
      closeShift: async () => {
        throw new InvariantViolationError("not used");
      },
      getSummary: async () => {
        throw new InvariantViolationError("not used");
      },
      addCashMovement: async (record) =>
        ok(
          CashMovement.create(
            {
              shiftId: record.shiftId,
              type: record.type,
              amount: Money.create(record.amount),
              note: record.note ?? "",
              createdBy: record.createdBy ?? null,
            },
            "cm-1",
            new Date()
          )
        ),
      listShifts: async () =>
        ok({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    return new AddCashMovementUseCase(repo);
  }

  it("mencatat kas masuk pada shift sendiri yang terbuka", async () => {
    const result = await setup(makeShift("s-1", "u-1", "open")).execute(
      { userId: "u-1" },
      "s-1",
      { type: "in", amount: 20000, note: "Tambahan" }
    );
    expect(result.success).toBe(true);
  });

  it("menolak nominal 0", async () => {
    const result = await setup(makeShift("s-1", "u-1", "open")).execute(
      { userId: "u-1" },
      "s-1",
      { type: "in", amount: 0 }
    );
    expect(result.success).toBe(false);
  });
});

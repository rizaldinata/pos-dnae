import { z } from "zod";
import type {
  IShiftRepository,
  ShiftListResult,
} from "@/modules/shifts/domain/repositories/shift.repository";
import type {
  CashMovement,
  Shift,
  ShiftSummary,
} from "@/modules/shifts/domain/entities/shift";
import {
  NotShiftOwnerError,
  ShiftAlreadyClosedError,
  ShiftNotFoundError,
} from "@/modules/shifts/domain/errors";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, isErr, type Result } from "@/shared/kernel/result";

export const OpenShiftSchema = z.object({
  openingCash: z
    .number({ error: "Modal awal harus angka" })
    .min(0, { error: "Modal awal minimal 0" }),
});

export const CloseShiftSchema = z.object({
  closingCash: z
    .number({ error: "Uang fisik harus angka" })
    .min(0, { error: "Uang fisik minimal 0" }),
  note: z
    .string()
    .trim()
    .max(300, { error: "Catatan maksimal 300 karakter" })
    .optional()
    .default(""),
});

export const CashMovementSchema = z.object({
  type: z.enum(["in", "out"], { error: "Tipe harus in/out" }),
  amount: z
    .number({ error: "Nominal harus angka" })
    .positive({ error: "Nominal harus lebih dari 0" }),
  note: z
    .string()
    .trim()
    .max(300, { error: "Catatan maksimal 300 karakter" })
    .optional()
    .default(""),
});

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export class OpenShiftUseCase {
  constructor(private readonly shifts: IShiftRepository) {}

  public async execute(
    userId: string,
    rawInput: { openingCash: number }
  ): Promise<Result<Shift, DomainError>> {
    const parsed = OpenShiftSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data buka shift tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    return this.shifts.openShift({
      userId,
      openingCash: Math.round(parsed.data.openingCash),
    });
  }
}

export class GetCurrentShiftUseCase {
  constructor(private readonly shifts: IShiftRepository) {}

  public async execute(
    userId: string
  ): Promise<Result<Shift | null, DomainError>> {
    return this.shifts.getCurrentShift(userId);
  }
}

export class CloseShiftUseCase {
  constructor(private readonly shifts: IShiftRepository) {}

  public async execute(
    actor: { userId: string; canManageAll: boolean },
    shiftId: string,
    rawInput: { closingCash: number; note?: string }
  ): Promise<Result<ShiftSummary, DomainError>> {
    const parsed = CloseShiftSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data tutup shift tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }

    const existing = await this.shifts.findById(shiftId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new ShiftNotFoundError());
    }
    if (!existing.data.isOpen()) {
      return err(new ShiftAlreadyClosedError());
    }
    if (existing.data.userId !== actor.userId && !actor.canManageAll) {
      return err(new NotShiftOwnerError());
    }

    return this.shifts.closeShift({
      shiftId,
      closingCash: Math.round(parsed.data.closingCash),
      note: parsed.data.note || null,
    });
  }
}

export class AddCashMovementUseCase {
  constructor(private readonly shifts: IShiftRepository) {}

  public async execute(
    actor: { userId: string },
    shiftId: string,
    rawInput: { type: "in" | "out"; amount: number; note?: string }
  ): Promise<Result<CashMovement, DomainError>> {
    const parsed = CashMovementSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError("Data kas tidak valid", toFieldErrors(parsed.error))
      );
    }

    const existing = await this.shifts.findById(shiftId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new ShiftNotFoundError());
    }
    if (!existing.data.isOpen()) {
      return err(new ShiftAlreadyClosedError());
    }
    if (existing.data.userId !== actor.userId) {
      return err(new NotShiftOwnerError());
    }

    return this.shifts.addCashMovement({
      shiftId,
      type: parsed.data.type,
      amount: Math.round(parsed.data.amount),
      note: parsed.data.note,
      createdBy: actor.userId,
    });
  }
}

export class GetShiftSummaryUseCase {
  constructor(private readonly shifts: IShiftRepository) {}

  public async execute(
    shiftId: string
  ): Promise<Result<ShiftSummary, DomainError>> {
    const existing = await this.shifts.findById(shiftId);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new ShiftNotFoundError());
    }
    return this.shifts.getSummary(shiftId);
  }
}

export class ListShiftsUseCase {
  constructor(private readonly shifts: IShiftRepository) {}

  public async execute(filter: {
    userId?: string;
    status?: "open" | "closed";
    page?: number;
    pageSize?: number;
  }): Promise<Result<ShiftListResult, DomainError>> {
    return this.shifts.listShifts({
      userId: filter.userId,
      status: filter.status,
      page: filter.page ?? 1,
      pageSize: Math.min(Math.max(filter.pageSize ?? 20, 1), 100),
    });
  }
}

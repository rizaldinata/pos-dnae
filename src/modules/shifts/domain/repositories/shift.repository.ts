import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  CashMovement,
  Shift,
  ShiftSummary,
} from "@/modules/shifts/domain/entities/shift";

export interface OpenShiftRecord {
  userId: string;
  openingCash: number;
}

export interface CashMovementRecord {
  shiftId: string;
  type: "in" | "out";
  amount: number;
  note?: string;
  createdBy?: string | null;
}

export interface CloseShiftRecord {
  shiftId: string;
  closingCash: number;
  note?: string | null;
}

export interface ShiftListFilter {
  userId?: string;
  from?: string;
  to?: string;
  status?: "open" | "closed";
  page?: number;
  pageSize?: number;
}

export interface ShiftListResult {
  items: Shift[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IShiftRepository {
  openShift(record: OpenShiftRecord): Promise<Result<Shift, DomainError>>;
  getCurrentShift(userId: string): Promise<Result<Shift | null, DomainError>>;
  findById(shiftId: string): Promise<Result<Shift | null, DomainError>>;
  closeShift(
    record: CloseShiftRecord
  ): Promise<Result<ShiftSummary, DomainError>>;
  getSummary(shiftId: string): Promise<Result<ShiftSummary, DomainError>>;
  addCashMovement(
    record: CashMovementRecord
  ): Promise<Result<CashMovement, DomainError>>;
  listShifts(
    filter: ShiftListFilter
  ): Promise<Result<ShiftListResult, DomainError>>;
}

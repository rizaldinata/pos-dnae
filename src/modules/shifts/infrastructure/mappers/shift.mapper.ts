import {
  CashMovement,
  Shift,
  type CashMovementType,
  type ShiftMethodSummary,
  type ShiftStatus,
  type ShiftSummary,
} from "@/modules/shifts/domain/entities/shift";
import { Money } from "@/shared/lib/money";

export interface ShiftRow {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number | string;
  expected_cash: number | string | null;
  closing_cash: number | string | null;
  difference: number | string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const SHIFT_STATUSES: ShiftStatus[] = ["open", "closed"];

function toMoney(value: number | string | null | undefined): Money | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Money.create(Math.round(Number(value)));
}

function toMoneyRequired(value: number | string): Money {
  return Money.create(Math.round(Number(value)));
}

export function mapShiftRow(row: ShiftRow): Shift {
  return Shift.create(
    {
      userId: row.user_id,
      openedAt: new Date(row.opened_at),
      closedAt: row.closed_at ? new Date(row.closed_at) : null,
      openingCash: toMoneyRequired(row.opening_cash),
      expectedCash: toMoney(row.expected_cash),
      closingCash: toMoney(row.closing_cash),
      difference: toMoney(row.difference),
      status: (SHIFT_STATUSES as string[]).includes(row.status)
        ? (row.status as ShiftStatus)
        : "open",
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }
  );
}

export interface CashMovementRow {
  id: string;
  shift_id: string;
  type: string;
  amount: number | string;
  note: string;
  created_by: string | null;
  created_at: string;
}

export function mapCashMovementRow(row: CashMovementRow): CashMovement {
  return CashMovement.create(
    {
      shiftId: row.shift_id,
      type:
        row.type === "out"
          ? ("out" as CashMovementType)
          : ("in" as CashMovementType),
      amount: toMoneyRequired(row.amount),
      note: row.note,
      createdBy: row.created_by,
    },
    row.id,
    new Date(row.created_at)
  );
}

interface SummaryJson {
  shift: ShiftRow;
  transactions: number;
  cash_sales: number | string;
  cash_in: number | string;
  cash_out: number | string;
  change_given: number | string;
  refunds_cash: number | string;
  expected_cash: number | string;
  by_method: {
    method_name: string;
    method_type: string;
    transactions: number;
    total: number | string;
  }[];
}

export function mapShiftSummaryJson(json: SummaryJson): ShiftSummary {
  const shift = mapShiftRow(json.shift);
  return {
    shift,
    transactions: Number(json.transactions),
    cashSales: toMoneyRequired(json.cash_sales),
    cashIn: toMoneyRequired(json.cash_in),
    cashOut: toMoneyRequired(json.cash_out),
    changeGiven: toMoneyRequired(json.change_given ?? 0),
    refundsCash: toMoneyRequired(json.refunds_cash),
    expectedCash: toMoneyRequired(json.expected_cash),
    closingCash: toMoney(shift.closingCash?.amount ?? null),
    difference: toMoney(shift.difference?.amount ?? null),
    byMethod: (json.by_method ?? []).map((m): ShiftMethodSummary => ({
      methodName: m.method_name,
      methodType: m.method_type,
      transactions: Number(m.transactions),
      total: toMoneyRequired(m.total),
    })),
  };
}

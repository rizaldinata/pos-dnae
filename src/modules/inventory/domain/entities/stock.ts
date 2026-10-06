import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";

export const STOCK_MOVEMENT_TYPES = [
  "sale",
  "purchase",
  "adjust",
  "return_in",
  "return_out",
  "opname",
  "void",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  sale: "Penjualan",
  purchase: "Pembelian",
  adjust: "Penyesuaian",
  return_in: "Retur masuk",
  return_out: "Retur keluar",
  opname: "Opname",
  void: "Void",
};

export function movementTypeLabel(type: StockMovementType): string {
  return MOVEMENT_LABELS[type];
}

export function isStockMovementType(value: string): value is StockMovementType {
  return (STOCK_MOVEMENT_TYPES as readonly string[]).includes(value);
}

export interface StockProps {
  variantId: string;
  qty: number;
}

export class Stock extends BaseEntity<StockProps, string> {
  private constructor(
    props: StockProps,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, props.variantId, timestamps);
  }

  public static create(
    props: StockProps,
    timestamps?: Partial<EntityTimestamps>
  ): Stock {
    return new Stock(props, timestamps);
  }

  public get variantId(): string {
    return this._props.variantId;
  }

  public get qty(): number {
    return this._props.qty;
  }
}

export interface StockMovementProps {
  variantId: string;
  type: StockMovementType;
  qtyChange: number;
  balanceAfter: number;
  refType: string | null;
  refId: string | null;
  note: string;
  createdBy: string | null;
  /** Batch terkait (Sub-PRD 4.1) — null bila pergerakan tidak terkait batch. */
  batchId?: string | null;
  /** No. batch untuk tampilan kartu stok (tampil bila batchId terisi). */
  batchNo?: string | null;
  /** Tanggal kedaluwarsa batch (YYYY-MM-DD) untuk tampilan. */
  batchExpiryDate?: string | null;
}

export class StockMovement extends BaseEntity<StockMovementProps> {
  private constructor(props: StockMovementProps, id: string, createdAt: Date) {
    super(props, id, { createdAt, updatedAt: createdAt });
  }

  public static create(
    props: StockMovementProps,
    id: string,
    createdAt: Date
  ): StockMovement {
    return new StockMovement(props, id, createdAt);
  }

  public get variantId(): string {
    return this._props.variantId;
  }

  public get type(): StockMovementType {
    return this._props.type;
  }

  public get typeLabel(): string {
    return movementTypeLabel(this._props.type);
  }

  public get qtyChange(): number {
    return this._props.qtyChange;
  }

  public get balanceAfter(): number {
    return this._props.balanceAfter;
  }

  public get refType(): string | null {
    return this._props.refType;
  }

  public get refId(): string | null {
    return this._props.refId;
  }

  public get note(): string {
    return this._props.note;
  }

  public get batchId(): string | null {
    return this._props.batchId ?? null;
  }

  public get batchNo(): string | null {
    return this._props.batchNo ?? null;
  }

  public get batchExpiryDate(): string | null {
    return this._props.batchExpiryDate ?? null;
  }
}

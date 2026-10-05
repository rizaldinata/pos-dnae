import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";

export type StockOpnameStatus = "draft" | "review" | "approved";

export interface StockOpnameProps {
  code: string;
  status: StockOpnameStatus;
  createdBy: string | null;
  approvedBy: string | null;
}

export class StockOpname extends BaseEntity<StockOpnameProps> {
  private constructor(
    props: StockOpnameProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: StockOpnameProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): StockOpname {
    return new StockOpname(props, id, timestamps);
  }

  public get code(): string {
    return this._props.code;
  }

  public get status(): StockOpnameStatus {
    return this._props.status;
  }

  public isFinal(): boolean {
    return this._props.status === "approved";
  }
}

export interface StockOpnameItemProps {
  opnameId: string;
  variantId: string;
  systemQty: number;
  actualQty: number;
  diff: number;
}

export class StockOpnameItem extends BaseEntity<StockOpnameItemProps> {
  private constructor(
    props: StockOpnameItemProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: StockOpnameItemProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): StockOpnameItem {
    return new StockOpnameItem(
      { ...props, diff: props.actualQty - props.systemQty },
      id,
      timestamps
    );
  }

  public get variantId(): string {
    return this._props.variantId;
  }

  public get systemQty(): number {
    return this._props.systemQty;
  }

  public get actualQty(): number {
    return this._props.actualQty;
  }

  public get diff(): number {
    return this._props.diff;
  }

  public withActualQty(actualQty: number): StockOpnameItem {
    return StockOpnameItem.create(
      {
        opnameId: this._props.opnameId,
        variantId: this._props.variantId,
        systemQty: this._props.systemQty,
        actualQty,
        diff: 0,
      },
      this.id
    );
  }
}

export interface StockOpnameItemView extends StockOpnameItemProps {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
}

export interface StockOpnameDetail {
  opname: StockOpname;
  items: StockOpnameItemView[];
  totalDiff: number;
}

import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";
import { Money } from "@/shared/lib/money";

export interface SupplierProps {
  name: string;
  phone: string;
  address: string;
  paymentTermsDays: number;
}

export class Supplier extends BaseEntity<SupplierProps> {
  private constructor(
    props: SupplierProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: SupplierProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Supplier {
    return new Supplier(
      {
        name: props.name.trim(),
        phone: props.phone.trim(),
        address: props.address.trim(),
        paymentTermsDays: props.paymentTermsDays,
      },
      id,
      timestamps
    );
  }

  public get name(): string {
    return this._props.name;
  }

  public get phone(): string {
    return this._props.phone;
  }

  public get address(): string {
    return this._props.address;
  }

  public get paymentTermsDays(): number {
    return this._props.paymentTermsDays;
  }
}

export type PurchaseOrderStatus =
  "draft" | "sent" | "partial" | "completed" | "cancelled";

export interface PurchaseOrderItemProps {
  poId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  qty: number;
  costPrice: Money;
  receivedQty: number;
}

export class PurchaseOrderItem extends BaseEntity<PurchaseOrderItemProps> {
  private constructor(
    props: PurchaseOrderItemProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: PurchaseOrderItemProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): PurchaseOrderItem {
    return new PurchaseOrderItem(props, id, timestamps);
  }

  public get variantId(): string {
    return this._props.variantId;
  }

  public get productName(): string {
    return this._props.productName;
  }

  public get variantName(): string {
    return this._props.variantName;
  }

  public get sku(): string {
    return this._props.sku;
  }

  public get qty(): number {
    return this._props.qty;
  }

  public get costPrice(): Money {
    return this._props.costPrice;
  }

  public get receivedQty(): number {
    return this._props.receivedQty;
  }

  public get remainingQty(): number {
    return Math.max(this._props.qty - this._props.receivedQty, 0);
  }

  public get lineTotal(): number {
    return Math.round(this._props.qty * this._props.costPrice.amount);
  }
}

export interface PurchaseOrderProps {
  poNo: string;
  supplierId: string;
  supplierName?: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  notes: string;
  total: Money;
  items: PurchaseOrderItem[];
}

export class PurchaseOrder extends BaseEntity<PurchaseOrderProps> {
  private constructor(
    props: PurchaseOrderProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: PurchaseOrderProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): PurchaseOrder {
    return new PurchaseOrder(props, id, timestamps);
  }

  public get poNo(): string {
    return this._props.poNo;
  }

  public get supplierId(): string {
    return this._props.supplierId;
  }

  public get supplierName(): string | undefined {
    return this._props.supplierName;
  }

  public get status(): PurchaseOrderStatus {
    return this._props.status;
  }

  public get orderDate(): string {
    return this._props.orderDate;
  }

  public get notes(): string {
    return this._props.notes;
  }

  public get total(): Money {
    return this._props.total;
  }

  public get items(): PurchaseOrderItem[] {
    return [...this._props.items];
  }

  public canEdit(): boolean {
    return this._props.status === "draft";
  }

  public canSend(): boolean {
    return this._props.status === "draft";
  }

  public canReceive(): boolean {
    return this._props.status === "sent" || this._props.status === "partial";
  }

  public canCancel(): boolean {
    if (
      this._props.status === "completed" ||
      this._props.status === "cancelled"
    ) {
      return false;
    }
    return this._props.items.every((item) => item.receivedQty <= 0);
  }
}

export interface GoodsReceiptItemProps {
  variantId: string;
  sku: string;
  qty: number;
  costPrice: Money;
  batchNo: string;
  expiryDate: string | null;
}

export interface GoodsReceiptInfo {
  id: string;
  grNo: string;
  receivedAt: Date;
}

export interface PurchaseReturnInfo {
  id: string;
  returnNo: string;
  reason: string;
  totalRefund: Money;
  createdAt: Date;
}

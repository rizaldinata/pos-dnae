import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";
import { Sku } from "@/modules/catalog/domain/value-objects/sku";
import { Money } from "@/shared/lib/money";

export interface ProductVariantProps {
  productId: string;
  sku: Sku;
  barcode: string | null;
  variantName: string;
  costPrice: Money;
  sellPrice: Money;
  minStock: number;
  trackStock: boolean;
  /** Foto varian sendiri; null = ikuti gambar produk (fallback). */
  imageUrl?: string | null;
  stockQty?: number;
}

export class ProductVariant extends BaseEntity<ProductVariantProps> {
  private constructor(
    props: ProductVariantProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: ProductVariantProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): ProductVariant {
    return new ProductVariant(
      {
        ...props,
        variantName: props.variantName.trim(),
        barcode: props.barcode?.trim() ? props.barcode.trim() : null,
        imageUrl: props.imageUrl?.trim() ? props.imageUrl.trim() : null,
      },
      id,
      timestamps
    );
  }

  public get productId(): string {
    return this._props.productId;
  }

  public get sku(): Sku {
    return this._props.sku;
  }

  public get barcode(): string | null {
    return this._props.barcode;
  }

  public get imageUrl(): string | null {
    return this._props.imageUrl ?? null;
  }

  public get variantName(): string {
    return this._props.variantName;
  }

  public get costPrice(): Money {
    return this._props.costPrice;
  }

  public get sellPrice(): Money {
    return this._props.sellPrice;
  }

  public get minStock(): number {
    return this._props.minStock;
  }

  public get trackStock(): boolean {
    return this._props.trackStock;
  }

  public get stockQty(): number | undefined {
    return this._props.stockQty;
  }

  public isLowStock(): boolean {
    if (this._props.stockQty === undefined || !this._props.trackStock) {
      return false;
    }
    return this._props.stockQty <= this._props.minStock;
  }
}

export interface ProductProps {
  name: string;
  categoryId: string | null;
  brandId: string | null;
  unitId: string | null;
  description: string;
  imageUrl: string | null;
  isBundle: boolean;
  isActive: boolean;
  categoryName?: string | null;
  brandName?: string | null;
  unitShortName?: string | null;
  variants: ProductVariant[];
}

export class Product extends BaseEntity<ProductProps> {
  private constructor(
    props: ProductProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: ProductProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Product {
    return new Product({ ...props, name: props.name.trim() }, id, timestamps);
  }

  public get name(): string {
    return this._props.name;
  }

  public get categoryId(): string | null {
    return this._props.categoryId;
  }

  public get brandId(): string | null {
    return this._props.brandId;
  }

  public get unitId(): string | null {
    return this._props.unitId;
  }

  public get description(): string {
    return this._props.description;
  }

  public get imageUrl(): string | null {
    return this._props.imageUrl;
  }

  public get isBundle(): boolean {
    return this._props.isBundle;
  }

  public get isActive(): boolean {
    return this._props.isActive;
  }

  public get categoryName(): string | null | undefined {
    return this._props.categoryName;
  }

  public get brandName(): string | null | undefined {
    return this._props.brandName;
  }

  public get unitShortName(): string | null | undefined {
    return this._props.unitShortName;
  }

  public get variants(): ProductVariant[] {
    return [...this._props.variants];
  }

  public defaultVariant(): ProductVariant | null {
    return this._props.variants[0] ?? null;
  }
}

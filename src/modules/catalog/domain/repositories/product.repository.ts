import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  Product,
  ProductVariant,
} from "@/modules/catalog/domain/entities/product";

export interface VariantWithProduct {
  variant: ProductVariant;
  productName: string;
}

export interface VariantInput {
  id?: string;
  sku: string;
  barcode?: string | null;
  variantName?: string;
  costPrice: number;
  sellPrice: number;
  minStock?: number;
  trackStock?: boolean;
}

export interface CreateProductRecord {
  name: string;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  description?: string;
  imageUrl?: string | null;
  isActive?: boolean;
  variants: VariantInput[];
}

export interface UpdateProductRecord {
  name?: string;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  description?: string;
  imageUrl?: string | null;
  isActive?: boolean;
  variants?: VariantInput[];
}

export interface ProductFilter {
  query?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ProductListResult {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IProductRepository {
  findById(id: string): Promise<Result<Product | null, DomainError>>;
  findVariantById(
    variantId: string
  ): Promise<Result<VariantWithProduct | null, DomainError>>;
  findBySku(sku: string): Promise<Result<ProductVariant | null, DomainError>>;
  findByBarcode(
    barcode: string
  ): Promise<Result<ProductVariant | null, DomainError>>;
  search(
    filter: ProductFilter
  ): Promise<Result<ProductListResult, DomainError>>;
  create(record: CreateProductRecord): Promise<Result<Product, DomainError>>;
  update(
    id: string,
    patch: UpdateProductRecord
  ): Promise<Result<Product, DomainError>>;
  softDelete(id: string): Promise<Result<void, DomainError>>;
}

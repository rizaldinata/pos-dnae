import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  Promotion,
  Voucher,
} from "@/modules/promotions/domain/entities/promotion";

export interface CreatePromotionRecord {
  name: string;
  type: "percent" | "amount" | "bogo";
  scope: "all" | "category" | "product";
  scopeRefId?: string | null;
  value?: number;
  buyQty?: number;
  getQty?: number;
  minPurchase?: number;
  startAt: string;
  endAt: string;
  isActive?: boolean;
}

export interface UpdatePromotionRecord {
  name?: string;
  value?: number;
  buyQty?: number;
  getQty?: number;
  minPurchase?: number;
  startAt?: string;
  endAt?: string;
  isActive?: boolean;
}

export interface IPromotionRepository {
  findById(id: string): Promise<Result<Promotion | null, DomainError>>;
  findActive(now?: Date): Promise<Result<Promotion[], DomainError>>;
  findAll(): Promise<Result<Promotion[], DomainError>>;
  create(
    record: CreatePromotionRecord
  ): Promise<Result<Promotion, DomainError>>;
  update(
    id: string,
    patch: UpdatePromotionRecord
  ): Promise<Result<Promotion, DomainError>>;
  toggleActive(
    id: string,
    isActive: boolean
  ): Promise<Result<Promotion, DomainError>>;
}

export interface CreateVoucherRecord {
  code: string;
  type: "percent" | "amount";
  value: number;
  quota: number;
  minPurchase?: number;
  expiresAt?: string | null;
}

export interface IVoucherRepository {
  findById(id: string): Promise<Result<Voucher | null, DomainError>>;
  findByCode(code: string): Promise<Result<Voucher | null, DomainError>>;
  findAll(): Promise<Result<Voucher[], DomainError>>;
  create(record: CreateVoucherRecord): Promise<Result<Voucher, DomainError>>;
  update(
    id: string,
    patch: {
      quota?: number;
      minPurchase?: number;
      expiresAt?: string | null;
      isActive?: boolean;
    }
  ): Promise<Result<Voucher, DomainError>>;
}

import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { Supplier } from "@/modules/purchasing/domain/entities/purchasing";

export interface CreateSupplierRecord {
  name: string;
  phone?: string;
  address?: string;
  paymentTermsDays?: number;
}

export interface UpdateSupplierRecord {
  name?: string;
  phone?: string;
  address?: string;
  paymentTermsDays?: number;
}

export interface ISupplierRepository {
  findById(id: string): Promise<Result<Supplier | null, DomainError>>;
  findAll(): Promise<Result<Supplier[], DomainError>>;
  create(record: CreateSupplierRecord): Promise<Result<Supplier, DomainError>>;
  update(
    id: string,
    patch: UpdateSupplierRecord
  ): Promise<Result<Supplier, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
}

import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { Brand } from "@/modules/catalog/domain/entities/brand";

export interface IBrandRepository {
  findById(id: string): Promise<Result<Brand | null, DomainError>>;
  findAll(): Promise<Result<Brand[], DomainError>>;
  create(name: string): Promise<Result<Brand, DomainError>>;
  update(id: string, name: string): Promise<Result<Brand, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
}

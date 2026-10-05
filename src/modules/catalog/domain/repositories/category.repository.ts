import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { Category } from "@/modules/catalog/domain/entities/category";

export interface ICategoryRepository {
  findById(id: string): Promise<Result<Category | null, DomainError>>;
  findAll(): Promise<Result<Category[], DomainError>>;
  create(
    name: string,
    parentId: string | null
  ): Promise<Result<Category, DomainError>>;
  update(
    id: string,
    patch: { name?: string; parentId?: string | null }
  ): Promise<Result<Category, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
}

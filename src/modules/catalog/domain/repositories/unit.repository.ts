import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { Unit } from "@/modules/catalog/domain/entities/unit";

export interface IUnitRepository {
  findById(id: string): Promise<Result<Unit | null, DomainError>>;
  findAll(): Promise<Result<Unit[], DomainError>>;
  create(name: string, shortName: string): Promise<Result<Unit, DomainError>>;
  update(
    id: string,
    patch: { name?: string; shortName?: string }
  ): Promise<Result<Unit, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
}

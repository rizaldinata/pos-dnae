import type { IBrandRepository } from "@/modules/catalog/domain/repositories/brand.repository";
import type { IUnitRepository } from "@/modules/catalog/domain/repositories/unit.repository";
import type { Brand } from "@/modules/catalog/domain/entities/brand";
import type { Unit } from "@/modules/catalog/domain/entities/unit";
import type {
  BrandInput,
  UnitInput,
} from "@/modules/catalog/application/dto/master-data.dto";
import {
  BrandInputSchema,
  UnitInputSchema,
} from "@/modules/catalog/application/dto/master-data.dto";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, type Result } from "@/shared/kernel/result";
import { toFieldErrors } from "@/modules/catalog/application/use-cases/create-product.use-case";

export class ListBrandsUseCase {
  constructor(private readonly brands: IBrandRepository) {}

  public async execute(): Promise<Result<Brand[], DomainError>> {
    return this.brands.findAll();
  }
}

export class CreateBrandUseCase {
  constructor(private readonly brands: IBrandRepository) {}

  public async execute(
    rawInput: BrandInput
  ): Promise<Result<Brand, DomainError>> {
    const parsed = BrandInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data brand tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    return this.brands.create(parsed.data.name);
  }
}

export class UpdateBrandUseCase {
  constructor(private readonly brands: IBrandRepository) {}

  public async execute(
    id: string,
    rawInput: BrandInput
  ): Promise<Result<Brand, DomainError>> {
    const parsed = BrandInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data brand tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await this.brands.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Brand", id));
    }
    return this.brands.update(id, parsed.data.name);
  }
}

export class DeleteBrandUseCase {
  constructor(private readonly brands: IBrandRepository) {}

  public async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.brands.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Brand", id));
    }
    return this.brands.remove(id);
  }
}

export class ListUnitsUseCase {
  constructor(private readonly units: IUnitRepository) {}

  public async execute(): Promise<Result<Unit[], DomainError>> {
    return this.units.findAll();
  }
}

export class CreateUnitUseCase {
  constructor(private readonly units: IUnitRepository) {}

  public async execute(
    rawInput: UnitInput
  ): Promise<Result<Unit, DomainError>> {
    const parsed = UnitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data satuan tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    return this.units.create(parsed.data.name, parsed.data.shortName);
  }
}

export class UpdateUnitUseCase {
  constructor(private readonly units: IUnitRepository) {}

  public async execute(
    id: string,
    rawInput: Partial<UnitInput>
  ): Promise<Result<Unit, DomainError>> {
    const parsed = UnitInputSchema.partial().safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data satuan tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await this.units.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Satuan", id));
    }
    return this.units.update(id, {
      name: parsed.data.name,
      shortName: parsed.data.shortName,
    });
  }
}

export class DeleteUnitUseCase {
  constructor(private readonly units: IUnitRepository) {}

  public async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.units.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Satuan", id));
    }
    return this.units.remove(id);
  }
}

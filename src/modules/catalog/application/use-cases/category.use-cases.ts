import type { ICategoryRepository } from "@/modules/catalog/domain/repositories/category.repository";
import type { Category } from "@/modules/catalog/domain/entities/category";
import {
  buildCategoryTree,
  type CategoryNode,
} from "@/modules/catalog/domain/entities/category";
import type { CategoryInput } from "@/modules/catalog/application/dto/master-data.dto";
import { CategoryInputSchema } from "@/modules/catalog/application/dto/master-data.dto";
import { CategoryHasChildrenError } from "@/modules/catalog/domain/errors";
import {
  NotFoundError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";
import { toFieldErrors } from "@/modules/catalog/application/use-cases/create-product.use-case";

export class ListCategoriesUseCase {
  constructor(private readonly categories: ICategoryRepository) {}

  public async execute(): Promise<Result<Category[], DomainError>> {
    return this.categories.findAll();
  }

  public async executeTree(): Promise<Result<CategoryNode[], DomainError>> {
    const result = await this.categories.findAll();
    if (isErr(result)) {
      return err(result.error);
    }
    return ok(buildCategoryTree(result.data));
  }
}

export class CreateCategoryUseCase {
  constructor(private readonly categories: ICategoryRepository) {}

  public async execute(
    rawInput: CategoryInput
  ): Promise<Result<Category, DomainError>> {
    const parsed = CategoryInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data kategori tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    if (parsed.data.parentId) {
      const parent = await this.categories.findById(parsed.data.parentId);
      if (isErr(parent)) {
        return err(parent.error);
      }
      if (parent.data === null) {
        return err(new NotFoundError("Kategori induk", parsed.data.parentId));
      }
    }
    return this.categories.create(
      parsed.data.name,
      parsed.data.parentId ?? null
    );
  }
}

export class UpdateCategoryUseCase {
  constructor(private readonly categories: ICategoryRepository) {}

  public async execute(
    id: string,
    rawInput: Partial<CategoryInput>
  ): Promise<Result<Category, DomainError>> {
    const parsed = CategoryInputSchema.partial().safeParse(rawInput);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data kategori tidak valid",
          toFieldErrors(parsed.error)
        )
      );
    }
    const existing = await this.categories.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Kategori", id));
    }
    if (parsed.data.parentId === id) {
      return err(
        new ValidationError(
          "Kategori tidak dapat menjadi induk bagi dirinya sendiri"
        )
      );
    }
    if (parsed.data.parentId) {
      const parent = await this.categories.findById(parsed.data.parentId);
      if (isErr(parent)) {
        return err(parent.error);
      }
      if (parent.data === null) {
        return err(new NotFoundError("Kategori induk", parsed.data.parentId));
      }
    }
    return this.categories.update(id, {
      name: parsed.data.name,
      parentId: parsed.data.parentId,
    });
  }
}

export class DeleteCategoryUseCase {
  constructor(private readonly categories: ICategoryRepository) {}

  public async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.categories.findById(id);
    if (isErr(existing)) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return err(new NotFoundError("Kategori", id));
    }
    const all = await this.categories.findAll();
    if (isErr(all)) {
      return err(all.error);
    }
    if (all.data.some((c) => c.parentId === id)) {
      return err(new CategoryHasChildrenError(existing.data.name));
    }
    return this.categories.remove(id);
  }
}

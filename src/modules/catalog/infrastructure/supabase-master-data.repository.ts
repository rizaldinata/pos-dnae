import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type { ICategoryRepository } from "@/modules/catalog/domain/repositories/category.repository";
import type { IBrandRepository } from "@/modules/catalog/domain/repositories/brand.repository";
import type { IUnitRepository } from "@/modules/catalog/domain/repositories/unit.repository";
import { Category } from "@/modules/catalog/domain/entities/category";
import { Brand } from "@/modules/catalog/domain/entities/brand";
import { Unit } from "@/modules/catalog/domain/entities/unit";
import {
  mapBrandRow,
  mapCategoryRow,
  mapUnitRow,
  type CategoryRow,
} from "@/modules/catalog/infrastructure/mappers/catalog.mapper";
import { conflictOrInvariant } from "@/modules/catalog/infrastructure/supabase-product.repository";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  NotFoundError,
  type DomainError,
} from "@/shared/kernel/errors";

export class SupabaseCategoryRepository implements ICategoryRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async findById(
    id: string
  ): Promise<Result<Category | null, DomainError>> {
    const { data, error } = await this.client
      .from("categories")
      .select("id,parent_id,name,created_at,updated_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapCategoryRow(data as unknown as CategoryRow));
  }

  public async findAll(): Promise<Result<Category[], DomainError>> {
    const { data, error } = await this.client
      .from("categories")
      .select("id,parent_id,name,created_at,updated_at")
      .is("deleted_at", null)
      .order("name");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(((data ?? []) as unknown as CategoryRow[]).map(mapCategoryRow));
  }

  public async create(
    name: string,
    parentId: string | null
  ): Promise<Result<Category, DomainError>> {
    const { data, error } = await this.client
      .from("categories")
      .insert({ name, parent_id: parentId })
      .select("id,parent_id,name,created_at,updated_at")
      .single();
    if (error || !data) {
      return err(
        conflictOrInvariant(
          error ? { code: error.code, message: error.message } : null
        )
      );
    }
    return ok(mapCategoryRow(data as unknown as CategoryRow));
  }

  public async update(
    id: string,
    patch: { name?: string; parentId?: string | null }
  ): Promise<Result<Category, DomainError>> {
    const payload: { name?: string; parent_id?: string | null } = {};
    if (patch.name !== undefined) {
      payload.name = patch.name;
    }
    if (patch.parentId !== undefined) {
      payload.parent_id = patch.parentId;
    }
    if (Object.keys(payload).length === 0) {
      const current = await this.findById(id);
      if (!current.success) {
        return err(current.error);
      }
      if (current.data === null) {
        return err(new NotFoundError("Kategori", id));
      }
      return ok(current.data);
    }
    const { data, error } = await this.client
      .from("categories")
      .update(payload)
      .eq("id", id)
      .select("id,parent_id,name,created_at,updated_at")
      .single();
    if (error || !data) {
      return err(
        conflictOrInvariant(
          error ? { code: error.code, message: error.message } : null
        )
      );
    }
    return ok(mapCategoryRow(data as unknown as CategoryRow));
  }

  public async remove(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.findById(id);
    if (!existing.success) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return ok(undefined);
    }
    const { error } = await this.client
      .from("categories")
      .delete()
      .eq("id", id);
    if (error) {
      return err(
        conflictOrInvariant(
          { code: error.code, message: error.message },
          existing.data.name
        )
      );
    }
    return ok(undefined);
  }
}

export class SupabaseBrandRepository implements IBrandRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async findById(
    id: string
  ): Promise<Result<Brand | null, DomainError>> {
    const { data, error } = await this.client
      .from("brands")
      .select("id,name,created_at,updated_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapBrandRow(data));
  }

  public async findAll(): Promise<Result<Brand[], DomainError>> {
    const { data, error } = await this.client
      .from("brands")
      .select("id,name,created_at,updated_at")
      .is("deleted_at", null)
      .order("name");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok((data ?? []).map(mapBrandRow));
  }

  public async create(name: string): Promise<Result<Brand, DomainError>> {
    const { data, error } = await this.client
      .from("brands")
      .insert({ name })
      .select("id,name,created_at,updated_at")
      .single();
    if (error || !data) {
      return err(
        conflictOrInvariant(
          error ? { code: error.code, message: error.message } : null
        )
      );
    }
    return ok(mapBrandRow(data));
  }

  public async update(
    id: string,
    name: string
  ): Promise<Result<Brand, DomainError>> {
    const { data, error } = await this.client
      .from("brands")
      .update({ name })
      .eq("id", id)
      .select("id,name,created_at,updated_at")
      .single();
    if (error || !data) {
      return err(
        conflictOrInvariant(
          error ? { code: error.code, message: error.message } : null
        )
      );
    }
    return ok(mapBrandRow(data));
  }

  public async remove(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.findById(id);
    if (!existing.success) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return ok(undefined);
    }
    const { error } = await this.client.from("brands").delete().eq("id", id);
    if (error) {
      return err(
        conflictOrInvariant(
          { code: error.code, message: error.message },
          existing.data.name
        )
      );
    }
    return ok(undefined);
  }
}

export class SupabaseUnitRepository implements IUnitRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async findById(id: string): Promise<Result<Unit | null, DomainError>> {
    const { data, error } = await this.client
      .from("units")
      .select("id,name,short_name,created_at,updated_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapUnitRow(data));
  }

  public async findAll(): Promise<Result<Unit[], DomainError>> {
    const { data, error } = await this.client
      .from("units")
      .select("id,name,short_name,created_at,updated_at")
      .is("deleted_at", null)
      .order("name");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok((data ?? []).map(mapUnitRow));
  }

  public async create(
    name: string,
    shortName: string
  ): Promise<Result<Unit, DomainError>> {
    const { data, error } = await this.client
      .from("units")
      .insert({ name, short_name: shortName })
      .select("id,name,short_name,created_at,updated_at")
      .single();
    if (error || !data) {
      return err(
        conflictOrInvariant(
          error ? { code: error.code, message: error.message } : null
        )
      );
    }
    return ok(mapUnitRow(data));
  }

  public async update(
    id: string,
    patch: { name?: string; shortName?: string }
  ): Promise<Result<Unit, DomainError>> {
    const payload: { name?: string; short_name?: string } = {};
    if (patch.name !== undefined) {
      payload.name = patch.name;
    }
    if (patch.shortName !== undefined) {
      payload.short_name = patch.shortName;
    }
    if (Object.keys(payload).length === 0) {
      const current = await this.findById(id);
      if (!current.success) {
        return err(current.error);
      }
      if (current.data === null) {
        return err(new NotFoundError("Satuan", id));
      }
      return ok(current.data);
    }
    const { data, error } = await this.client
      .from("units")
      .update(payload)
      .eq("id", id)
      .select("id,name,short_name,created_at,updated_at")
      .single();
    if (error || !data) {
      return err(
        conflictOrInvariant(
          error ? { code: error.code, message: error.message } : null
        )
      );
    }
    return ok(mapUnitRow(data));
  }

  public async remove(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.findById(id);
    if (!existing.success) {
      return err(existing.error);
    }
    if (existing.data === null) {
      return ok(undefined);
    }
    const { error } = await this.client.from("units").delete().eq("id", id);
    if (error) {
      return err(
        conflictOrInvariant(
          { code: error.code, message: error.message },
          existing.data.name
        )
      );
    }
    return ok(undefined);
  }
}

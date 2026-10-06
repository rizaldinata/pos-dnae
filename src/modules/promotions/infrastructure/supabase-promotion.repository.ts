import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  CreatePromotionRecord,
  CreateVoucherRecord,
  IPromotionRepository,
  IVoucherRepository,
  UpdatePromotionRecord,
} from "@/modules/promotions/domain/repositories/promotion.repository";
import {
  Promotion,
  Voucher,
  type PromotionScope,
  type PromotionType,
} from "@/modules/promotions/domain/entities/promotion";
import { Money } from "@/shared/lib/money";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  ConflictError,
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

interface PromotionRow {
  id: string;
  name: string;
  type: string;
  scope: string;
  scope_ref_id: string | null;
  value: number | string;
  buy_qty: number;
  get_qty: number;
  min_purchase: number | string;
  start_at: string;
  end_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const PROMOTION_TYPES: PromotionType[] = ["percent", "amount", "bogo"];
const PROMOTION_SCOPES: PromotionScope[] = ["all", "category", "product"];

function mapPromotionRow(row: PromotionRow): Promotion | null {
  if (
    !(PROMOTION_TYPES as string[]).includes(row.type) ||
    !(PROMOTION_SCOPES as string[]).includes(row.scope)
  ) {
    return null;
  }
  return Promotion.create(
    {
      name: row.name,
      type: row.type as PromotionType,
      scope: row.scope as PromotionScope,
      scopeRefId: row.scope_ref_id,
      value: Money.create(Math.round(Number(row.value))),
      buyQty: row.buy_qty,
      getQty: row.get_qty,
      minPurchase: Money.create(Math.round(Number(row.min_purchase))),
      startAt: new Date(row.start_at),
      endAt: new Date(row.end_at),
      isActive: row.is_active,
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }
  );
}

interface VoucherRow {
  id: string;
  code: string;
  type: string;
  value: number | string;
  quota: number;
  used_count: number;
  min_purchase: number | string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapVoucherRow(row: VoucherRow): Voucher | null {
  if (row.type !== "percent" && row.type !== "amount") {
    return null;
  }
  return Voucher.create(
    {
      code: row.code,
      type: row.type,
      value: Money.create(Math.round(Number(row.value))),
      quota: row.quota,
      usedCount: row.used_count,
      minPurchase: Money.create(Math.round(Number(row.min_purchase))),
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      isActive: row.is_active,
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }
  );
}

const PROMOTION_SELECT =
  "id,name,type,scope,scope_ref_id,value,buy_qty,get_qty,min_purchase,start_at,end_at,is_active,created_at,updated_at";
const VOUCHER_SELECT =
  "id,code,type,value,quota,used_count,min_purchase,expires_at,is_active,created_at,updated_at";

export class SupabasePromotionRepository implements IPromotionRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async findById(
    id: string
  ): Promise<Result<Promotion | null, DomainError>> {
    const { data, error } = await this.client
      .from("promotions")
      .select(PROMOTION_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapPromotionRow(data as unknown as PromotionRow));
  }

  private async list(
    whereActive: boolean
  ): Promise<Result<Promotion[], DomainError>> {
    let query = this.client
      .from("promotions")
      .select(PROMOTION_SELECT)
      .order("created_at", { ascending: false });
    if (whereActive) {
      const now = new Date().toISOString();
      query = query
        .eq("is_active", true)
        .lte("start_at", now)
        .gte("end_at", now);
    }
    const { data, error } = await query;
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(
      ((data ?? []) as unknown as PromotionRow[])
        .map(mapPromotionRow)
        .filter((p): p is Promotion => p !== null)
    );
  }

  public async findActive(): Promise<Result<Promotion[], DomainError>> {
    return this.list(true);
  }

  public async findAll(): Promise<Result<Promotion[], DomainError>> {
    return this.list(false);
  }

  public async create(
    record: CreatePromotionRecord
  ): Promise<Result<Promotion, DomainError>> {
    const { data, error } = await this.client
      .from("promotions")
      .insert({
        name: record.name,
        type: record.type,
        scope: record.scope,
        scope_ref_id: record.scopeRefId ?? null,
        value: record.value ?? 0,
        buy_qty: record.buyQty ?? 0,
        get_qty: record.getQty ?? 0,
        min_purchase: record.minPurchase ?? 0,
        start_at: `${record.startAt}T00:00:00+07:00`,
        end_at: `${record.endAt}T23:59:59.999+07:00`,
        is_active: record.isActive ?? true,
      })
      .select("id")
      .single();
    if (error || !data) {
      return err(
        new InvariantViolationError(
          `Database error: ${error?.message ?? "unknown"}`
        )
      );
    }
    const created = await this.findById((data as { id: string }).id);
    if (!created.success) {
      return err(created.error);
    }
    if (created.data === null) {
      return err(new InvariantViolationError("Promo gagal dimuat"));
    }
    return ok(created.data);
  }

  public async update(
    id: string,
    patch: UpdatePromotionRecord
  ): Promise<Result<Promotion, DomainError>> {
    const payload: {
      name?: string;
      value?: number;
      buy_qty?: number;
      get_qty?: number;
      min_purchase?: number;
      start_at?: string;
      end_at?: string;
      is_active?: boolean;
    } = {};
    if (patch.name !== undefined) {
      payload.name = patch.name;
    }
    if (patch.value !== undefined) {
      payload.value = patch.value;
    }
    if (patch.buyQty !== undefined) {
      payload.buy_qty = patch.buyQty;
    }
    if (patch.getQty !== undefined) {
      payload.get_qty = patch.getQty;
    }
    if (patch.minPurchase !== undefined) {
      payload.min_purchase = patch.minPurchase;
    }
    if (patch.startAt !== undefined) {
      payload.start_at = `${patch.startAt}T00:00:00+07:00`;
    }
    if (patch.endAt !== undefined) {
      payload.end_at = `${patch.endAt}T23:59:59.999+07:00`;
    }
    if (patch.isActive !== undefined) {
      payload.is_active = patch.isActive;
    }
    if (Object.keys(payload).length > 0) {
      const { error } = await this.client
        .from("promotions")
        .update(payload)
        .eq("id", id);
      if (error) {
        return err(
          new InvariantViolationError(`Database error: ${error.message}`)
        );
      }
    }
    const updated = await this.findById(id);
    if (!updated.success) {
      return err(updated.error);
    }
    if (updated.data === null) {
      return err(new InvariantViolationError("Promo gagal dimuat"));
    }
    return ok(updated.data);
  }

  public async toggleActive(
    id: string,
    isActive: boolean
  ): Promise<Result<Promotion, DomainError>> {
    return this.update(id, { isActive });
  }
}

export class SupabaseVoucherRepository implements IVoucherRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async findById(
    id: string
  ): Promise<Result<Voucher | null, DomainError>> {
    const { data, error } = await this.client
      .from("vouchers")
      .select(VOUCHER_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapVoucherRow(data as unknown as VoucherRow));
  }

  public async findByCode(
    code: string
  ): Promise<Result<Voucher | null, DomainError>> {
    const { data, error } = await this.client
      .from("vouchers")
      .select(VOUCHER_SELECT)
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapVoucherRow(data as unknown as VoucherRow));
  }

  public async findAll(): Promise<Result<Voucher[], DomainError>> {
    const { data, error } = await this.client
      .from("vouchers")
      .select(VOUCHER_SELECT)
      .order("created_at", { ascending: false });
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(
      ((data ?? []) as unknown as VoucherRow[])
        .map(mapVoucherRow)
        .filter((v): v is NonNullable<typeof v> => v !== null)
    );
  }

  public async create(
    record: CreateVoucherRecord
  ): Promise<Result<Voucher, DomainError>> {
    const { data, error } = await this.client
      .from("vouchers")
      .insert({
        code: record.code.trim().toUpperCase(),
        type: record.type,
        value: record.value,
        quota: record.quota,
        min_purchase: record.minPurchase ?? 0,
        expires_at: record.expiresAt
          ? `${record.expiresAt}T23:59:59.999+07:00`
          : null,
        is_active: true,
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") {
        return err(
          new ConflictError(`Kode "${record.code.toUpperCase()}" sudah dipakai`)
        );
      }
      return err(
        new InvariantViolationError(
          `Database error: ${error?.message ?? "unknown"}`
        )
      );
    }
    const created = await this.findById((data as { id: string }).id);
    if (!created.success) {
      return err(created.error);
    }
    if (created.data === null) {
      return err(new InvariantViolationError("Voucher gagal dimuat"));
    }
    return ok(created.data);
  }

  public async update(
    id: string,
    patch: {
      quota?: number;
      minPurchase?: number;
      expiresAt?: string | null;
      isActive?: boolean;
    }
  ): Promise<Result<Voucher, DomainError>> {
    const payload: {
      quota?: number;
      min_purchase?: number;
      expires_at?: string | null;
      is_active?: boolean;
    } = {};
    if (patch.quota !== undefined) {
      payload.quota = patch.quota;
    }
    if (patch.minPurchase !== undefined) {
      payload.min_purchase = patch.minPurchase;
    }
    if (patch.expiresAt !== undefined) {
      payload.expires_at = patch.expiresAt
        ? `${patch.expiresAt}T23:59:59.999+07:00`
        : null;
    }
    if (patch.isActive !== undefined) {
      payload.is_active = patch.isActive;
    }
    if (Object.keys(payload).length > 0) {
      const { error } = await this.client
        .from("vouchers")
        .update(payload)
        .eq("id", id);
      if (error) {
        return err(
          new InvariantViolationError(`Database error: ${error.message}`)
        );
      }
    }
    const updated = await this.findById(id);
    if (!updated.success) {
      return err(updated.error);
    }
    if (updated.data === null) {
      return err(new InvariantViolationError("Voucher gagal dimuat"));
    }
    return ok(updated.data);
  }
}

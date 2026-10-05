import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  IStockMovementRepository,
  IStockRepository,
  RecordMovementRecord,
  StockCardFilter,
  StockCardResult,
  StockOverviewFilter,
  StockOverviewResult,
} from "@/modules/inventory/domain/repositories/stock.repository";
import type {
  AdjustStockRecord,
  AdjustStockResult,
} from "@/modules/inventory/domain/repositories/stock-opname.repository";
import type { StockOverview } from "@/modules/inventory/domain/services/stock-policy";
import type { Stock } from "@/modules/inventory/domain/entities/stock";
import type { StockMovement } from "@/modules/inventory/domain/entities/stock";
import {
  mapStockMovementRow,
  mapStockOverviewRow,
  mapStockRow,
  type StockMovementRow,
  type StockOverviewRow,
} from "@/modules/inventory/infrastructure/mappers/stock.mapper";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  ValidationError,
  type DomainError,
} from "@/shared/kernel/errors";

const OVERVIEW_SELECT =
  "variant_id,product_id,product_name,variant_name,sku,barcode,category_id,category_name,min_stock,track_stock,qty,status";

function sanitizeLikeQuery(query: string): string {
  return query
    .replace(/[%_,()"']/g, "")
    .trim()
    .slice(0, 100);
}

export class SupabaseStockRepository implements IStockRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async getByVariantId(
    variantId: string
  ): Promise<Result<Stock | null, DomainError>> {
    const { data, error } = await this.client
      .from("stocks")
      .select("variant_id,qty")
      .eq("variant_id", variantId)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapStockRow(data));
  }

  public async getOverviewByVariantId(
    variantId: string
  ): Promise<Result<StockOverview | null, DomainError>> {
    const { data, error } = await this.client
      .from("stock_overview")
      .select(OVERVIEW_SELECT)
      .eq("variant_id", variantId)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return ok(mapStockOverviewRow(data as unknown as StockOverviewRow));
  }

  public async adjustStock(
    record: AdjustStockRecord
  ): Promise<Result<AdjustStockResult, DomainError>> {
    const { data, error } = await this.client.rpc("adjust_stock", {
      p_variant_id: record.variantId,
      p_new_qty: record.newQty,
      p_reason: record.reason,
    });
    if (error) {
      if (error.message.includes("ADJUST_REASON_REQUIRED")) {
        return err(new ValidationError("Alasan penyesuaian wajib diisi"));
      }
      if (error.message.includes("FORBIDDEN")) {
        return err(
          new ValidationError("Anda tidak memiliki hak menyesuaikan stok")
        );
      }
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const json = data as unknown as {
      variant_id: string;
      old_qty: number | string;
      new_qty: number | string;
    };
    return ok({
      variantId: json.variant_id,
      oldQty: Number(json.old_qty),
      newQty: Number(json.new_qty),
    });
  }

  public async countLowStock(): Promise<Result<number, DomainError>> {
    const { count, error } = await this.client
      .from("stock_overview")
      .select("variant_id", { count: "exact", head: true })
      .or("status.eq.menipis,status.eq.habis");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(count ?? 0);
  }

  public async listOverview(
    filter: StockOverviewFilter
  ): Promise<Result<StockOverviewResult, DomainError>> {
    const page = filter.page ?? 1;
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client
      .from("stock_overview")
      .select(OVERVIEW_SELECT, { count: "exact" });

    const rawQuery = (filter.query ?? "").trim();
    if (rawQuery) {
      const safe = sanitizeLikeQuery(rawQuery);
      query = query.or(
        `product_name.ilike.%${safe}%,sku.ilike.%${safe}%,barcode.ilike.%${safe}%`
      );
    }
    if (filter.categoryId) {
      query = query.eq("category_id", filter.categoryId);
    }
    if (filter.status) {
      query = query.eq("status", filter.status);
    }

    const { data, error, count } = await query
      .order("product_name")
      .range(from, to);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const items = ((data ?? []) as unknown as StockOverviewRow[])
      .map(mapStockOverviewRow)
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return ok({ items, total: count ?? 0, page, pageSize });
  }
}

const MOVEMENT_SELECT =
  "id,variant_id,type,qty_change,balance_after,ref_type,ref_id,note,created_by,created_at";

export class SupabaseStockMovementRepository implements IStockMovementRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly stocks: IStockRepository
  ) {}

  public async create(
    record: RecordMovementRecord
  ): Promise<Result<StockMovement, DomainError>> {
    const stockResult = await this.stocks.getByVariantId(record.variantId);
    if (!stockResult.success) {
      return err(stockResult.error);
    }
    const balanceAfter = (stockResult.data?.qty ?? 0) + record.qtyChange;

    const { data, error } = await this.client
      .from("stock_movements")
      .insert({
        variant_id: record.variantId,
        type: record.type,
        qty_change: record.qtyChange,
        balance_after: balanceAfter,
        ref_type: record.refType ?? null,
        ref_id: record.refId ?? null,
        note: record.note ?? "",
        created_by: record.createdBy ?? null,
      })
      .select(MOVEMENT_SELECT)
      .single();

    if (error || !data) {
      return err(
        new InvariantViolationError(
          `Database error: ${error?.message ?? "unknown"}`
        )
      );
    }
    const mapped = mapStockMovementRow(data as unknown as StockMovementRow);
    if (!mapped) {
      return err(new InvariantViolationError("Tipe pergerakan tidak dikenal"));
    }
    return ok(mapped);
  }

  public async findByVariantId(
    filter: StockCardFilter
  ): Promise<Result<StockCardResult, DomainError>> {
    const page = filter.page ?? 1;
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const overviewResult = await this.stocks.getOverviewByVariantId(
      filter.variantId
    );
    if (!overviewResult.success) {
      return err(overviewResult.error);
    }

    let query = this.client
      .from("stock_movements")
      .select(MOVEMENT_SELECT, { count: "exact" })
      .eq("variant_id", filter.variantId);
    if (filter.type) {
      query = query.eq("type", filter.type);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const movements = ((data ?? []) as unknown as StockMovementRow[])
      .map(mapStockMovementRow)
      .filter((m): m is NonNullable<typeof m> => m !== null);
    return ok({
      overview: overviewResult.data,
      movements,
      total: count ?? 0,
      page,
      pageSize,
    });
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  IStockMovementRepository,
  IStockRepository,
  ExpiringBatchFilter,
  ExpiringBatchItem,
  ExpiringBatchResult,
  RecordMovementRecord,
  StockBatchInfo,
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
import {
  addDaysIso,
  classifyExpiry,
} from "@/modules/inventory/domain/services/expiry-policy";
import { toISODateJakarta } from "@/shared/lib/date";

const OVERVIEW_SELECT =
  "variant_id,product_id,product_name,variant_name,sku,barcode,category_id,category_name,min_stock,track_stock,qty,status";

interface ExpiringBatchRow {
  id: string;
  variant_id: string;
  batch_no: string;
  qty: number | string;
  expiry_date: string;
  product_variants: {
    sku: string;
    variant_name: string;
    products: { name: string };
  };
}

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

  public async countExpiringBatches(
    warningDays: number
  ): Promise<Result<number, DomainError>> {
    const today = toISODateJakarta();
    const cutoff = addDaysIso(today, warningDays);
    const { count, error } = await this.client
      .from("stock_batches")
      .select("id", { count: "exact", head: true })
      .not("expiry_date", "is", null)
      .gt("qty", 0)
      .lte("expiry_date", cutoff);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(count ?? 0);
  }

  public async listExpiringBatches(
    filter: ExpiringBatchFilter
  ): Promise<Result<ExpiringBatchResult, DomainError>> {
    const page = filter.page ?? 1;
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const warningDays = Math.min(Math.max(filter.warningDays, 1), 365);
    const today = toISODateJakarta();
    const cutoff = addDaysIso(today, warningDays);

    let query = this.client
      .from("stock_batches")
      .select(
        `id,
         variant_id,
         batch_no,
         qty,
         expiry_date,
         product_variants!inner (
           sku,
           variant_name,
           products!inner ( name )
         )`,
        { count: "exact" }
      )
      .not("expiry_date", "is", null)
      .gt("qty", 0)
      .lte("expiry_date", cutoff);

    if (filter.status === "expired") {
      query = query.lt("expiry_date", today);
    } else if (filter.status === "expiring") {
      query = query.gte("expiry_date", today);
    }

    const { data, error, count } = await query
      .order("expiry_date", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }

    const items = ((data ?? []) as unknown as ExpiringBatchRow[])
      .map((row): ExpiringBatchItem | null => {
        const status = classifyExpiry(row.expiry_date, warningDays, today);
        if (status === "ok") {
          return null;
        }
        return {
          id: row.id,
          variantId: row.variant_id,
          productName: row.product_variants.products.name,
          variantName: row.product_variants.variant_name,
          sku: row.product_variants.sku,
          batchNo: row.batch_no,
          qty: Number(row.qty),
          expiryDate: row.expiry_date,
          status,
        };
      })
      .filter((item): item is ExpiringBatchItem => item !== null);

    return ok({ items, total: count ?? 0, page, pageSize });
  }

  public async listBatchesByVariant(
    variantId: string
  ): Promise<Result<StockBatchInfo[], DomainError>> {
    const { data, error } = await this.client
      .from("stock_batches")
      .select("id,batch_no,qty,expiry_date")
      .eq("variant_id", variantId)
      .gt("qty", 0)
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(
      (data ?? []).map((row) => ({
        id: row.id,
        batchNo: row.batch_no,
        qty: Number(row.qty),
        expiryDate: row.expiry_date,
      }))
    );
  }
}

const MOVEMENT_SELECT =
  "id,variant_id,type,qty_change,balance_after,ref_type,ref_id,note,created_by,created_at,batch_id,stock_batches(batch_no,expiry_date)";

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

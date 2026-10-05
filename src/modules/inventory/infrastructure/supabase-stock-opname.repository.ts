import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type { IStockOpnameRepository } from "@/modules/inventory/domain/repositories/stock-opname.repository";
import {
  StockOpname,
  type StockOpnameDetail,
  type StockOpnameItemView,
  type StockOpnameStatus,
} from "@/modules/inventory/domain/entities/stock-opname";
import { ValidationError } from "@/shared/kernel/errors";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

const OPNAME_STATUSES: StockOpnameStatus[] = ["draft", "review", "approved"];

interface OpnameRow {
  id: string;
  code: string;
  status: string;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

interface OpnameItemRow {
  id: string;
  opname_id: string;
  variant_id: string;
  system_qty: number | string;
  actual_qty: number | string;
  diff: number | string;
  product_variants: {
    sku: string;
    variant_name: string;
    products: { name: string } | null;
  } | null;
}

function mapOpnameRow(row: OpnameRow): StockOpname {
  return StockOpname.create(
    {
      code: row.code,
      status: (OPNAME_STATUSES as string[]).includes(row.status)
        ? (row.status as StockOpnameStatus)
        : "draft",
      createdBy: row.created_by,
      approvedBy: row.approved_by,
    },
    row.id,
    { createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at) }
  );
}

function mapItemRow(row: OpnameItemRow, opnameId: string): StockOpnameItemView {
  return {
    id: row.id,
    opnameId,
    variantId: row.variant_id,
    systemQty: Number(row.system_qty),
    actualQty: Number(row.actual_qty),
    diff: Number(row.diff),
    productName: row.product_variants?.products?.name ?? "-",
    variantName: row.product_variants?.variant_name ?? "",
    sku: row.product_variants?.sku ?? "",
  };
}

const ITEM_SELECT = `
  id,
  opname_id,
  variant_id,
  system_qty,
  actual_qty,
  diff,
  product_variants (
    sku,
    variant_name,
    products ( name )
  )
`;

async function loadDetail(
  client: SupabaseClient<Database>,
  opname: StockOpname
): Promise<Result<StockOpnameDetail, DomainError>> {
  const { data, error } = await client
    .from("stock_opname_items")
    .select(ITEM_SELECT)
    .eq("opname_id", opname.id)
    .order("created_at");
  if (error) {
    return err(new InvariantViolationError(`Database error: ${error.message}`));
  }
  const items = ((data ?? []) as unknown as OpnameItemRow[]).map((row) =>
    mapItemRow(row, opname.id)
  );
  return ok({
    opname,
    items,
    totalDiff: items.reduce((sum, item) => sum + (item.diff !== 0 ? 1 : 0), 0),
  });
}

function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replaceAll("/", "-");
}

export class SupabaseStockOpnameRepository implements IStockOpnameRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async createOpname(
    categoryId?: string | null
  ): Promise<Result<StockOpnameDetail, DomainError>> {
    const { data: seq, error: seqError } = await this.client.rpc(
      "next_number",
      { p_name: "opname" }
    );
    if (seqError || typeof seq !== "number") {
      return err(
        new InvariantViolationError(
          `Database error: ${seqError?.message ?? "unknown"}`
        )
      );
    }
    const code = `OPN-${jakartaToday().replaceAll("-", "")}-${String(seq).padStart(4, "0")}`;

    let variantQuery = this.client
      .from("product_variants")
      .select("id,product_id,products!inner ( id, category_id, deleted_at )")
      .is("products.deleted_at", null);
    if (categoryId) {
      variantQuery = variantQuery.eq("products.category_id", categoryId);
    }
    const { data: variants, error: variantError } = await variantQuery;
    if (variantError) {
      return err(
        new InvariantViolationError(`Database error: ${variantError.message}`)
      );
    }
    if (!variants || variants.length === 0) {
      return err(
        new InvariantViolationError("Tidak ada varian untuk diopname")
      );
    }

    const { data: opnameRow, error: opnameError } = await this.client
      .from("stock_opnames")
      .insert({ code, status: "draft" })
      .select("id,code,status,created_by,approved_by,created_at,updated_at")
      .single();
    if (opnameError || !opnameRow) {
      return err(
        new InvariantViolationError(
          `Database error: ${opnameError?.message ?? "unknown"}`
        )
      );
    }

    const variantIds = (variants as { id: string }[]).map((v) => v.id);
    const { data: stocks, error: stockError } = await this.client
      .from("stocks")
      .select("variant_id,qty")
      .in("variant_id", variantIds);
    if (stockError) {
      return err(
        new InvariantViolationError(`Database error: ${stockError.message}`)
      );
    }
    const qtyByVariant = new Map(
      ((stocks ?? []) as { variant_id: string; qty: number | string }[]).map(
        (s) => [s.variant_id, Number(s.qty)] as const
      )
    );

    const { error: itemsError } = await this.client
      .from("stock_opname_items")
      .insert(
        variantIds.map((variantId) => {
          const systemQty = qtyByVariant.get(variantId) ?? 0;
          return {
            opname_id: (opnameRow as { id: string }).id,
            variant_id: variantId,
            system_qty: systemQty,
            actual_qty: systemQty,
            diff: 0,
          };
        })
      );
    if (itemsError) {
      return err(
        new InvariantViolationError(`Database error: ${itemsError.message}`)
      );
    }

    return loadDetail(
      this.client,
      mapOpnameRow(opnameRow as unknown as OpnameRow)
    );
  }

  public async findById(
    opnameId: string
  ): Promise<Result<StockOpnameDetail | null, DomainError>> {
    const { data, error } = await this.client
      .from("stock_opnames")
      .select("id,code,status,created_by,approved_by,created_at,updated_at")
      .eq("id", opnameId)
      .maybeSingle();
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    if (data === null) {
      return ok(null);
    }
    return loadDetail(this.client, mapOpnameRow(data as unknown as OpnameRow));
  }

  public async listOpnames(): Promise<Result<StockOpname[], DomainError>> {
    const { data, error } = await this.client
      .from("stock_opnames")
      .select("id,code,status,created_by,approved_by,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok(((data ?? []) as unknown as OpnameRow[]).map(mapOpnameRow));
  }

  public async updateItem(
    opnameId: string,
    variantId: string,
    actualQty: number
  ): Promise<Result<StockOpnameDetail, DomainError>> {
    const { data: current, error: currentError } = await this.client
      .from("stock_opname_items")
      .select("id,system_qty")
      .eq("opname_id", opnameId)
      .eq("variant_id", variantId)
      .maybeSingle();
    if (currentError) {
      return err(
        new InvariantViolationError(`Database error: ${currentError.message}`)
      );
    }
    if (current === null) {
      return err(new InvariantViolationError("Item opname tidak ditemukan"));
    }
    const systemQty = Number(
      (current as { system_qty: number | string }).system_qty
    );
    const { error } = await this.client
      .from("stock_opname_items")
      .update({ actual_qty: actualQty, diff: actualQty - systemQty })
      .eq("opname_id", opnameId)
      .eq("variant_id", variantId);
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const detail = await this.findById(opnameId);
    if (!detail.success) {
      return err(detail.error);
    }
    if (detail.data === null) {
      return err(new InvariantViolationError("Sesi opname tidak ditemukan"));
    }
    return ok(detail.data);
  }

  public async approveOpname(
    opnameId: string
  ): Promise<Result<{ adjustedItems: number }, DomainError>> {
    const { data, error } = await this.client.rpc("approve_stock_opname", {
      p_opname_id: opnameId,
    });
    if (error) {
      if (error.message.includes("OPNAME_ALREADY_APPROVED")) {
        return err(new ValidationError("Sesi opname sudah disetujui"));
      }
      if (error.message.includes("FORBIDDEN")) {
        return err(
          new ValidationError("Anda tidak memiliki hak approve opname")
        );
      }
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    return ok({
      adjustedItems: Number(
        (data as { adjusted_items: number }).adjusted_items ?? 0
      ),
    });
  }
}

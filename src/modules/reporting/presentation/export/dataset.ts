import { getAppContainer } from "@/di/container";
import { err, isErr, ok, type Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import { toISODateJakarta, formatDateTimeJakarta } from "@/shared/lib/date";
import type { Product } from "@/modules/catalog/domain/entities/product";

export const EXPORT_TYPES = [
  "penjualan",
  "penjualan-produk",
  "kasir",
  "pembayaran",
  "retur",
  "shift",
  "stok",
  "produk",
  "laba-rugi",
  "laba-produk",
  "laba-periode",
] as const;

export type ExportType = (typeof EXPORT_TYPES)[number];

/** Tipe yang memiliki template PDF (RPT-06). */
export const PDF_TYPES = ["penjualan", "laba-rugi"] as const;

export type PdfType = (typeof PDF_TYPES)[number];

export function isExportType(value: string): value is ExportType {
  return (EXPORT_TYPES as readonly string[]).includes(value);
}

export function isPdfType(value: string): value is PdfType {
  return (PDF_TYPES as readonly string[]).includes(value);
}

/** Permission minimum per tipe ekspor, selaras dengan guard halamannya. */
export const EXPORT_PERMISSIONS: Record<ExportType, string> = {
  penjualan: "report.view",
  "penjualan-produk": "report.view",
  kasir: "report.view",
  pembayaran: "report.view",
  retur: "report.view",
  shift: "report.view",
  stok: "report.view",
  produk: "product.manage",
  "laba-rugi": "report.profit.view",
  "laba-produk": "report.profit.view",
  "laba-periode": "report.profit.view",
};

export type ExportColumnType = "text" | "money" | "number" | "qty" | "percent";

export interface ExportColumn {
  key: string;
  label: string;
  type: ExportColumnType;
}

export type ExportCellValue = string | number | null;

/** Tabel generik yang dipakai serializer Excel dan PDF. */
export interface ExportDataset {
  /** Nama file dasar tanpa ekstensi, ASCII-only. */
  filename: string;
  title: string;
  subtitle: string;
  columns: ExportColumn[];
  rows: Record<string, ExportCellValue>[];
  totals?: Record<string, ExportCellValue>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateParam(
  params: URLSearchParams,
  key: string,
  fallback: string
): string {
  const value = params.get(key);
  return value && DATE_RE.test(value) ? value : fallback;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00+07:00`);
  d.setDate(d.getDate() + days);
  return toISODateJakarta(d);
}

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function dateRangeToken(from: string, to: string): string {
  return from === to ? from : `${from}_${to}`;
}

async function loadPenjualan(
  params: URLSearchParams
): Promise<Result<ExportDataset, DomainError>> {
  const container = await getAppContainer();
  const today = toISODateJakarta(new Date());
  const mode = params.get("mode");
  const date = dateParam(params, "date", today);
  const dateFrom = dateParam(params, "from", addDays(today, -6));
  const dateTo = dateParam(params, "to", today);
  const year = Number(params.get("year")) || Number(today.slice(0, 4));
  const month = Math.min(
    Math.max(Number(params.get("month")) || Number(today.slice(5, 7)), 1),
    12
  );

  const query =
    mode === "rentang"
      ? ({ mode: "range", dateFrom, dateTo } as const)
      : mode === "bulanan"
        ? ({ mode: "monthly", year, month } as const)
        : ({ mode: "daily", date } as const);

  const result = await container.reporting.getSalesReport.execute(query);
  if (isErr(result)) {
    return err(result.error);
  }
  const report = result.data;
  const token =
    query.mode === "range"
      ? dateRangeToken(query.dateFrom, query.dateTo)
      : query.mode === "daily"
        ? query.date
        : `${query.year}-${String(query.month).padStart(2, "0")}`;

  return ok({
    filename: `laporan-penjualan-${token}`,
    title: "Laporan Penjualan",
    subtitle: `Periode: ${report.label}`,
    columns: [
      { key: "day", label: "Tanggal", type: "text" },
      { key: "transactions", label: "Transaksi", type: "number" },
      { key: "grossSales", label: "Penjualan kotor", type: "money" },
      { key: "discountTotal", label: "Diskon", type: "money" },
      { key: "netSales", label: "Penjualan bersih", type: "money" },
      { key: "itemsSold", label: "Item terjual", type: "qty" },
    ],
    rows: report.days.map((d) => ({ ...d })),
    totals: { day: "TOTAL", ...report.totals },
  });
}

async function loadOperational(
  type: "penjualan-produk" | "kasir" | "pembayaran",
  params: URLSearchParams
): Promise<Result<ExportDataset, DomainError>> {
  const container = await getAppContainer();
  const today = toISODateJakarta(new Date());
  const dateFrom = dateParam(params, "from", addDays(today, -6));
  const dateTo = dateParam(params, "to", today);
  const categoryId = params.get("categoryId") || "";

  const result = await container.reporting.getOperationalReport.execute({
    dateFrom,
    dateTo,
    categoryId: categoryId || null,
  });
  if (isErr(result)) {
    return err(result.error);
  }
  const report = result.data;
  const range = dateRangeToken(dateFrom, dateTo);

  if (type === "penjualan-produk") {
    return ok({
      filename: `laporan-penjualan-produk-${range}`,
      title: "Laporan Penjualan per Produk",
      subtitle: `${dateFrom} s/d ${dateTo}${categoryId ? " (kategori tersaring)" : ""}`,
      columns: [
        { key: "productName", label: "Produk", type: "text" },
        { key: "variantName", label: "Varian", type: "text" },
        { key: "sku", label: "SKU", type: "text" },
        { key: "qtySold", label: "Qty", type: "qty" },
        { key: "revenue", label: "Pendapatan", type: "money" },
        { key: "avgPrice", label: "Harga rata-rata", type: "money" },
      ],
      rows: report.productSales.map((r) => ({ ...r })),
    });
  }

  if (type === "kasir") {
    return ok({
      filename: `laporan-kasir-${range}`,
      title: "Laporan Penjualan per Kasir",
      subtitle: `${dateFrom} s/d ${dateTo}`,
      columns: [
        { key: "cashierName", label: "Kasir", type: "text" },
        { key: "transactions", label: "Transaksi", type: "number" },
        { key: "revenue", label: "Penjualan", type: "money" },
        { key: "avgPerTransaction", label: "Rata-rata", type: "money" },
      ],
      rows: report.cashierSales.map((r) => ({ ...r })),
    });
  }

  return ok({
    filename: `laporan-pembayaran-${range}`,
    title: "Laporan Penjualan per Metode Pembayaran",
    subtitle: `${dateFrom} s/d ${dateTo}`,
    columns: [
      { key: "methodName", label: "Metode", type: "text" },
      { key: "methodType", label: "Tipe", type: "text" },
      { key: "transactions", label: "Transaksi", type: "number" },
      { key: "total", label: "Nominal", type: "money" },
      { key: "sharePercent", label: "Porsi (%)", type: "percent" },
    ],
    rows: report.paymentMethodSales.map((r) => ({ ...r })),
  });
}

async function loadRetur(): Promise<Result<ExportDataset, DomainError>> {
  const container = await getAppContainer();
  const result = await container.sales.listReturns.execute({
    page: 1,
    pageSize: 100,
  });
  if (isErr(result)) {
    return err(result.error);
  }
  const today = toISODateJakarta(new Date());
  const { items, total } = result.data;
  return ok({
    filename: `laporan-retur-${today}`,
    title: "Laporan Retur",
    subtitle: `${items.length} dari ${total} retur (100 terbaru)`,
    columns: [
      { key: "createdAt", label: "Tanggal", type: "text" },
      { key: "invoiceNo", label: "Invoice asal", type: "text" },
      { key: "reason", label: "Alasan", type: "text" },
      { key: "refundMethodName", label: "Metode refund", type: "text" },
      { key: "totalRefund", label: "Total refund", type: "money" },
    ],
    rows: items.map((r) => ({
      createdAt: formatDateTimeJakarta(r.createdAt),
      invoiceNo: r.invoiceNo,
      reason: r.reason,
      refundMethodName: r.refundMethodName,
      totalRefund: r.totalRefund.amount,
    })),
  });
}

async function loadShift(): Promise<Result<ExportDataset, DomainError>> {
  const container = await getAppContainer();
  const result = await container.shifts.listShifts.execute({
    page: 1,
    pageSize: 100,
  });
  if (isErr(result)) {
    return err(result.error);
  }
  const today = toISODateJakarta(new Date());
  const { items, total } = result.data;
  return ok({
    filename: `laporan-shift-${today}`,
    title: "Laporan Shift",
    subtitle: `${items.length} dari ${total} shift (100 terbaru)`,
    columns: [
      { key: "openedAt", label: "Dibuka", type: "text" },
      { key: "closedAt", label: "Ditutup", type: "text" },
      { key: "openingCash", label: "Modal", type: "money" },
      { key: "expectedCash", label: "Ekspektasi", type: "money" },
      { key: "closingCash", label: "Fisik", type: "money" },
      { key: "difference", label: "Selisih", type: "money" },
      { key: "status", label: "Status", type: "text" },
    ],
    rows: items.map((s) => ({
      openedAt: formatDateTimeJakarta(s.openedAt),
      closedAt: s.closedAt ? formatDateTimeJakarta(s.closedAt) : null,
      openingCash: s.openingCash.amount,
      expectedCash: s.expectedCash ? s.expectedCash.amount : null,
      closingCash: s.closingCash ? s.closingCash.amount : null,
      difference: s.difference ? s.difference.amount : null,
      status: s.status,
    })),
  });
}

async function loadStok(): Promise<Result<ExportDataset, DomainError>> {
  const container = await getAppContainer();
  const result = await container.reporting.getStockValuation.execute();
  if (isErr(result)) {
    return err(result.error);
  }
  const today = toISODateJakarta(new Date());
  const rows = result.data.rows.map((r) => ({
    productName: r.productName,
    variantName: r.variantName,
    sku: r.sku,
    qty: r.qty,
    costPrice: r.costPrice,
    stockValue: r.stockValue,
  }));
  return ok({
    filename: `laporan-stok-${today}`,
    title: "Laporan Stok & Nilai Persediaan",
    subtitle: `Posisi stok per ${today}`,
    columns: [
      { key: "productName", label: "Produk", type: "text" },
      { key: "variantName", label: "Varian", type: "text" },
      { key: "sku", label: "SKU", type: "text" },
      { key: "qty", label: "Qty", type: "qty" },
      { key: "costPrice", label: "Harga modal", type: "money" },
      { key: "stockValue", label: "Nilai", type: "money" },
    ],
    rows,
    totals: {
      productName: "TOTAL",
      stockValue: result.data.totalValue,
    },
  });
}

async function loadDaftarProduk(
  params: URLSearchParams
): Promise<Result<ExportDataset, DomainError>> {
  const container = await getAppContainer();
  const baseQuery = params.get("q")?.trim() ?? "";
  const categoryId = params.get("categoryId") || undefined;
  const brandId = params.get("brandId") || undefined;
  const status = params.get("status");
  const isActive =
    status === "aktif" ? true : status === "nonaktif" ? false : undefined;

  const items: Product[] = [];
  let total = 0;
  for (let page = 1; page <= 10; page += 1) {
    const result = await container.catalog.listProducts.execute({
      query: baseQuery,
      categoryId,
      brandId,
      isActive,
      page,
      pageSize: 100,
    });
    if (isErr(result)) {
      return err(result.error);
    }
    items.push(...result.data.items);
    total = result.data.total;
    if (items.length >= total) {
      break;
    }
  }

  const today = toISODateJakarta(new Date());
  const variantRows = items.flatMap((p) =>
    p.variants.map((v) => ({
      name: p.name,
      category: p.categoryName ?? "",
      brand: p.brandName ?? "",
      unit: p.unitShortName ?? "",
      sku: v.sku.value,
      barcode: v.barcode ?? "",
      variantName: v.variantName,
      costPrice: v.costPrice.amount,
      sellPrice: v.sellPrice.amount,
      minStock: v.minStock,
    }))
  );

  // Kolom sengaja sama dengan template impor (PRD-06) agar ekspor bisa
  // langsung diimpor ulang (round-trip).
  return ok({
    filename: `daftar-produk-${today}`,
    title: "Daftar Produk",
    subtitle:
      `${items.length} dari ${total} produk (${variantRows.length} baris varian)` +
      (baseQuery ? ` untuk "${baseQuery}"` : ""),
    columns: [
      { key: "name", label: "Nama", type: "text" },
      { key: "category", label: "Kategori", type: "text" },
      { key: "brand", label: "Brand", type: "text" },
      { key: "unit", label: "Satuan", type: "text" },
      { key: "sku", label: "SKU", type: "text" },
      { key: "barcode", label: "Barcode", type: "text" },
      { key: "variantName", label: "Nama Varian", type: "text" },
      { key: "costPrice", label: "Harga Modal", type: "money" },
      { key: "sellPrice", label: "Harga Jual", type: "money" },
      { key: "minStock", label: "Stok Minimum", type: "number" },
    ],
    rows: variantRows,
  });
}

async function loadLabaRugi(
  params: URLSearchParams
): Promise<Result<ExportDataset, DomainError>> {
  const container = await getAppContainer();
  const today = toISODateJakarta(new Date());
  const dateFrom = dateParam(params, "from", monthStart(today));
  const dateTo = dateParam(params, "to", today);

  const result = await container.finance.getProfitLoss.execute({
    dateFrom,
    dateTo,
  });
  if (isErr(result)) {
    return err(result.error);
  }
  const { summary, expensesByCategory } = result.data;

  return ok({
    filename: `laporan-laba-rugi-${dateRangeToken(dateFrom, dateTo)}`,
    title: "Laporan Laba Rugi",
    subtitle: `${dateFrom} s/d ${dateTo}`,
    columns: [
      { key: "item", label: "Item", type: "text" },
      { key: "value", label: "Nilai", type: "money" },
    ],
    rows: [
      { item: "Penjualan bruto", value: summary.grossSales },
      { item: "Diskon", value: -summary.discountTotal },
      { item: "Penjualan neto", value: summary.netSales },
      { item: "HPP", value: -summary.cogs },
      { item: "Laba kotor", value: summary.grossProfit },
      ...expensesByCategory.map((c) => ({
        item: `Pengeluaran: ${c.categoryName}`,
        value: -c.total,
      })),
      { item: "Total pengeluaran", value: -summary.expenseTotal },
      { item: "Laba bersih", value: summary.netProfit },
    ],
  });
}

async function loadLabaProduk(
  params: URLSearchParams
): Promise<Result<ExportDataset, DomainError>> {
  const container = await getAppContainer();
  const today = toISODateJakarta(new Date());
  const dateFrom = dateParam(params, "from", monthStart(today));
  const dateTo = dateParam(params, "to", today);
  const categoryId = params.get("categoryId") || "";
  const sortParam = params.get("sort");
  const sort =
    sortParam === "margin" ||
    sortParam === "qty" ||
    sortParam === "revenue" ||
    sortParam === "name"
      ? sortParam
      : "profit";

  const result = await container.reporting.getProductProfit.execute({
    dateFrom,
    dateTo,
    categoryId: categoryId || null,
    sort,
  });
  if (isErr(result)) {
    return err(result.error);
  }
  const report = result.data;

  return ok({
    filename: `laporan-laba-produk-${dateRangeToken(dateFrom, dateTo)}`,
    title: "Laporan Laba per Produk",
    subtitle: `${dateFrom} s/d ${dateTo}${categoryId ? " (kategori tersaring)" : ""}`,
    columns: [
      { key: "productName", label: "Produk", type: "text" },
      { key: "qtySold", label: "Qty terjual", type: "qty" },
      { key: "revenue", label: "Pendapatan", type: "money" },
      { key: "cogs", label: "HPP", type: "money" },
      { key: "profit", label: "Laba", type: "money" },
      { key: "marginPercent", label: "Margin (%)", type: "percent" },
    ],
    rows: report.rows.map((r) => ({ ...r })),
    totals: report.rows.length
      ? {
          productName: "TOTAL",
          qtySold: report.rows.reduce((sum, r) => sum + r.qtySold, 0),
          revenue: report.rows.reduce((sum, r) => sum + r.revenue, 0),
          cogs: report.rows.reduce((sum, r) => sum + r.cogs, 0),
          profit: report.rows.reduce((sum, r) => sum + r.profit, 0),
          marginPercent: report.rows.reduce((sum, r) => sum + r.revenue, 0)
            ? Math.round(
                (report.rows.reduce((sum, r) => sum + r.profit, 0) /
                  report.rows.reduce((sum, r) => sum + r.revenue, 0)) *
                  1000
              ) / 10
            : 0,
        }
      : undefined,
  });
}

async function loadLabaPeriode(
  params: URLSearchParams
): Promise<Result<ExportDataset, DomainError>> {
  const container = await getAppContainer();
  const today = toISODateJakarta(new Date());
  const grainParam = params.get("grain");
  const granularity =
    grainParam === "week" || grainParam === "month" ? grainParam : "day";
  const defaultSpan =
    granularity === "day" ? 29 : granularity === "week" ? 83 : 364;
  const dateFrom = dateParam(params, "from", addDays(today, -defaultSpan));
  const dateTo = dateParam(params, "to", today);

  const result = await container.reporting.getPeriodProfit.execute({
    dateFrom,
    dateTo,
    granularity,
  });
  if (isErr(result)) {
    return err(result.error);
  }
  const report = result.data;
  const grainLabel =
    granularity === "day"
      ? "harian"
      : granularity === "week"
        ? "mingguan"
        : "bulanan";

  return ok({
    filename: `laporan-laba-periode-${dateRangeToken(dateFrom, dateTo)}`,
    title: "Laporan Laba per Periode",
    subtitle: `${dateFrom} s/d ${dateTo} (tampilan ${grainLabel})`,
    columns: [
      { key: "periodStart", label: "Periode", type: "text" },
      { key: "netSales", label: "Penjualan neto", type: "money" },
      { key: "cogs", label: "HPP", type: "money" },
      { key: "expenseTotal", label: "Pengeluaran", type: "money" },
      { key: "netProfit", label: "Laba bersih", type: "money" },
    ],
    rows: report.rows.map((r) => ({ ...r })),
    totals: {
      periodStart: "TOTAL",
      netSales: report.totals.netSales,
      cogs: report.totals.cogs,
      expenseTotal: report.totals.expenseTotal,
      netProfit: report.totals.netProfit,
    },
  });
}

/** Membangun dataset laporan untuk satu tipe ekspor. */
export async function loadExportDataset(
  type: ExportType,
  params: URLSearchParams
): Promise<Result<ExportDataset, DomainError>> {
  switch (type) {
    case "penjualan":
      return loadPenjualan(params);
    case "penjualan-produk":
    case "kasir":
    case "pembayaran":
      return loadOperational(type, params);
    case "retur":
      return loadRetur();
    case "shift":
      return loadShift();
    case "stok":
      return loadStok();
    case "produk":
      return loadDaftarProduk(params);
    case "laba-rugi":
      return loadLabaRugi(params);
    case "laba-produk":
      return loadLabaProduk(params);
    case "laba-periode":
      return loadLabaPeriode(params);
  }
}

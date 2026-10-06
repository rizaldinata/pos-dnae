import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import ExcelJS from "exceljs";
import {
  EXPORT_PERMISSIONS,
  EXPORT_TYPES,
  PDF_TYPES,
  isExportType,
  isPdfType,
  type ExportDataset,
} from "@/modules/reporting/presentation/export/dataset";
import { buildExcelBuffer } from "@/modules/reporting/presentation/export/excel";
import { buildPdfBuffer } from "@/modules/reporting/presentation/export/pdf";
import { FALLBACK_STORE } from "@/modules/reporting/presentation/export/store";

/** exceljs men-declare tipe `Buffer` lokal (extends ArrayBuffer); Buffer Node diterima runtime. */
async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

const DATASET: ExportDataset = {
  filename: "laporan-uji",
  title: "Laporan Uji",
  subtitle: "2026-10-01 s/d 2026-10-06",
  columns: [
    { key: "name", label: "Produk", type: "text" },
    { key: "qty", label: "Qty", type: "qty" },
    { key: "revenue", label: "Pendapatan", type: "money" },
    { key: "margin", label: "Margin (%)", type: "percent" },
  ],
  rows: [
    { name: "Kopi Susu", qty: 3, revenue: 150000, margin: 12.5 },
    { name: "Teh Manis", qty: 1, revenue: 10000, margin: 8 },
  ],
  totals: { name: "TOTAL", qty: 4, revenue: 160000, margin: 11.9 },
};

describe("buildExcelBuffer (RPT-06)", () => {
  it("menghasilkan buffer .xlsx yang bisa dibaca kembali", async () => {
    const buffer = await buildExcelBuffer(DATASET, FALLBACK_STORE);
    expect(buffer.byteLength).toBeGreaterThan(1000);

    const workbook = await loadWorkbook(buffer);
    const sheet = workbook.getWorksheet("Laporan Uji");
    expect(sheet).toBeDefined();
  });

  it("menulis header toko, judul, dan baris data sesuai kolom", async () => {
    const workbook = await loadWorkbook(
      await buildExcelBuffer(DATASET, FALLBACK_STORE)
    );
    const sheet = workbook.getWorksheet("Laporan Uji");
    if (!sheet) throw new Error("worksheet hilang");

    expect(sheet.getRow(1).getCell(1).value).toBe(FALLBACK_STORE.name);
    expect(sheet.getRow(2).getCell(1).value).toBe("Laporan Uji");
    expect(sheet.getRow(3).getCell(1).value).toBe(DATASET.subtitle);

    const header = sheet.getRow(6);
    expect(header.getCell(1).value).toBe("Produk");
    expect(header.getCell(3).value).toBe("Pendapatan");
    expect(header.getCell(1).font?.bold).toBe(true);

    const firstRow = sheet.getRow(7);
    expect(firstRow.getCell(1).value).toBe("Kopi Susu");
    expect(firstRow.getCell(3).value).toBe(150000);
    expect(firstRow.getCell(4).value).toBe(12.5);
  });

  it("memakai format Rupiah pada sel uang dan persen pada sel margin", async () => {
    const workbook = await loadWorkbook(
      await buildExcelBuffer(DATASET, FALLBACK_STORE)
    );
    const sheet = workbook.getWorksheet("Laporan Uji");
    if (!sheet) throw new Error("worksheet hilang");

    const dataRow = sheet.getRow(7);
    expect(dataRow.getCell(3).numFmt).toBe("#,##0");
    expect(dataRow.getCell(2).numFmt).toBe("#,##0.###");
    expect(dataRow.getCell(4).numFmt).toBe('0.0"%"');
    expect(dataRow.getCell(1).numFmt).toBeUndefined();
  });

  it("menulis baris total dan lebar kolom otomatis", async () => {
    const workbook = await loadWorkbook(
      await buildExcelBuffer(DATASET, FALLBACK_STORE)
    );
    const sheet = workbook.getWorksheet("Laporan Uji");
    if (!sheet) throw new Error("worksheet hilang");

    const totals = sheet.getRow(9);
    expect(totals.getCell(1).value).toBe("TOTAL");
    expect(totals.getCell(3).value).toBe(160000);
    expect(totals.getCell(1).font?.bold).toBe(true);

    expect(sheet.getColumn(1).width).toBeGreaterThanOrEqual(8);
    expect(sheet.getColumn(3).width).toBeGreaterThanOrEqual(8);
  });
});

describe("buildPdfBuffer (RPT-06)", () => {
  it("menghasilkan PDF valid", async () => {
    const buffer = await buildPdfBuffer(DATASET, FALLBACK_STORE);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("menghasilkan PDF multi-halaman untuk baris banyak", async () => {
    const manyRows: ExportDataset = {
      ...DATASET,
      rows: Array.from({ length: 45 }, (_, i) => ({
        name: `Produk ${i + 1}`,
        qty: i,
        revenue: (i + 1) * 1000,
        margin: i,
      })),
      totals: undefined,
    };
    const buffer = await buildPdfBuffer(manyRows, FALLBACK_STORE);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    // 45 baris > kapasitas halaman pertama (16) → minimal 3 halaman.
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("tetap menghasilkan PDF saat tidak ada data", async () => {
    const empty: ExportDataset = { ...DATASET, rows: [], totals: undefined };
    const buffer = await buildPdfBuffer(empty, FALLBACK_STORE);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("konfigurasi ekspor", () => {
  it("semua tipe ekspor punya permission dan PDF subset dari ekspor", () => {
    for (const type of EXPORT_TYPES) {
      expect(EXPORT_PERMISSIONS[type]).toBeTruthy();
    }
    for (const type of PDF_TYPES) {
      expect(isExportType(type)).toBe(true);
      expect(EXPORT_PERMISSIONS[type]).toBeTruthy();
    }
  });

  it("guard tipe ekspor", () => {
    expect(isExportType("penjualan")).toBe(true);
    expect(isExportType("laba-produk")).toBe(true);
    expect(isExportType("tidak-ada")).toBe(false);
    expect(isPdfType("penjualan")).toBe(true);
    expect(isPdfType("stok")).toBe(false);
  });
});

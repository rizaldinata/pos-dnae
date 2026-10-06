import ExcelJS from "exceljs";
import type { ExportCellValue, ExportColumn, ExportDataset } from "./dataset";
import type { ExportStoreInfo } from "./store";
import { formatDateTimeJakarta } from "@/shared/lib/date";

const NUM_FMT: Record<Exclude<ExportColumn["type"], "text">, string> = {
  money: "#,##0",
  number: "#,##0",
  qty: "#,##0.###",
  percent: '0.0"%"',
};

const HEADER_FILL = "FF111827";
const TOTALS_FILL = "FFE5E7EB";
const BORDER_COLOR = "FFE5E7EB";

function rawLength(
  col: ExportColumn,
  value: ExportCellValue | undefined
): number {
  if (value === null || value === undefined) {
    return 1;
  }
  if (col.type === "text") {
    return String(value).length;
  }
  if (col.type === "percent") {
    return `${value}`.length + 2;
  }
  // Angka: hitung digit dengan pemisah ribuan (id-ID pakai titik, lebar mirip koma).
  return String(Math.round(Number(value))).length + 4;
}

function columnWidth(col: ExportColumn, dataset: ExportDataset): number {
  const longest = dataset.rows.reduce(
    (max, row) => Math.max(max, rawLength(col, row[col.key])),
    col.label.length
  );
  return Math.min(Math.max(longest + 2, 8), 48);
}

function toCellValue(
  col: ExportColumn,
  value: ExportCellValue | undefined
): ExcelJS.CellValue {
  if (value === null || value === undefined) {
    return col.type === "text" ? "-" : null;
  }
  if (col.type === "text") {
    return String(value);
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/** Membangun buffer .xlsx dari dataset laporan. */
export async function buildExcelBuffer(
  dataset: ExportDataset,
  store: ExportStoreInfo
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = store.name;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(dataset.title.slice(0, 31));

  const nameRow = sheet.addRow([store.name]);
  nameRow.getCell(1).font = { bold: true, size: 14 };
  const titleRow = sheet.addRow([dataset.title]);
  titleRow.getCell(1).font = { bold: true, size: 12 };
  const subtitleRow = sheet.addRow([dataset.subtitle]);
  subtitleRow.getCell(1).font = {
    italic: true,
    size: 10,
    color: { argb: "FF6B7280" },
  };
  const printedRow = sheet.addRow([
    `Dicetak: ${formatDateTimeJakarta(new Date())}`,
  ]);
  printedRow.getCell(1).font = {
    italic: true,
    size: 9,
    color: { argb: "FF6B7280" },
  };
  sheet.addRow([]);

  const headerRow = sheet.addRow(dataset.columns.map((c) => c.label));
  headerRow.eachCell((cell, colNumber) => {
    const col = dataset.columns[colNumber - 1];
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    cell.alignment = {
      horizontal: col && col.type !== "text" ? "right" : "left",
      vertical: "middle",
    };
    cell.border = { bottom: { style: "thin", color: { argb: BORDER_COLOR } } };
  });

  for (const row of dataset.rows) {
    const values = dataset.columns.map((col) => toCellValue(col, row[col.key]));
    const dataRow = sheet.addRow(values);
    dataRow.eachCell((cell, colNumber) => {
      const col = dataset.columns[colNumber - 1];
      if (!col) return;
      if (col.type !== "text") {
        cell.numFmt = NUM_FMT[col.type];
        cell.alignment = { horizontal: "right" };
      }
      cell.border = {
        bottom: { style: "hair", color: { argb: BORDER_COLOR } },
      };
    });
  }

  if (dataset.totals) {
    const values = dataset.columns.map((col) =>
      toCellValue(col, dataset.totals?.[col.key] ?? null)
    );
    const totalsRow = sheet.addRow(values);
    totalsRow.eachCell((cell, colNumber) => {
      const col = dataset.columns[colNumber - 1];
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: TOTALS_FILL },
      };
      if (col && col.type !== "text") {
        cell.numFmt = NUM_FMT[col.type];
        cell.alignment = { horizontal: "right" };
      }
      cell.border = { top: { style: "thin", color: { argb: BORDER_COLOR } } };
    });
  }

  dataset.columns.forEach((col, index) => {
    sheet.getColumn(index + 1).width = columnWidth(col, dataset);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as unknown as Uint8Array);
}

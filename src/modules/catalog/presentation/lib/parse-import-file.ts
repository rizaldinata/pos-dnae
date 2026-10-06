import ExcelJS from "exceljs";
import { parseCsv } from "@/shared/lib/csv";

/** Ekstensi file impor yang didukung (PRD-06): CSV atau Excel. */
export function importFileKind(filename: string): "csv" | "xlsx" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    return "csv";
  }
  if (lower.endsWith(".xlsx")) {
    return "xlsx";
  }
  return null;
}

function cellToString(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("result" in value) {
      return value.result === null || value.result === undefined
        ? ""
        : String(value.result);
    }
    if ("hyperlink" in value) {
      return value.text ?? value.hyperlink ?? "";
    }
    return "";
  }
  return String(value);
}

/**
 * Baca file impor (CSV/Excel) menjadi baris sel.
 * Sheet pertama saja yang dibaca; sel dijadikan string agar identik dengan
 * parser CSV (header dicari dengan locateImportHeader, bukan baris pertama).
 */
export async function parseImportFile(file: File): Promise<string[][]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = importFileKind(file.name);

  if (kind === "csv") {
    return parseCsv(buffer.toString("utf8"));
  }
  if (kind === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return [];
    }
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = cellToString(cell);
      });
      for (let i = 0; i < cells.length; i += 1) {
        cells[i] = cells[i] ?? "";
      }
      rows.push(cells);
    });
    return rows;
  }

  throw new Error("Format file harus .csv atau .xlsx");
}

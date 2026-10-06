import { toCsv } from "@/shared/lib/csv";
import type { ExportCellValue, ExportDataset } from "./dataset";

/**
 * Bangun teks CSV dari dataset laporan (RPT-06 / PRD-06).
 * CSV dibuat polos (hanya baris header kolom + baris data, tanpa judul toko)
 * sehingga bisa langsung diimpor ulang — khususnya ekspor daftar produk.
 * Nilai uang/angka ditulis mentah (tanpa format pemisah ribuan).
 */
export function datasetToCsv(dataset: ExportDataset): string {
  const header = dataset.columns.map((col) => col.label);
  const rows = dataset.rows.map((row) =>
    dataset.columns.map((col) => {
      const value: ExportCellValue | undefined = row[col.key];
      return value === null || value === undefined ? "" : value;
    })
  );
  // BOM UTF-8 agar karakter Indonesia tampil benar di Excel Windows.
  return "\uFEFF" + toCsv([header, ...rows]);
}

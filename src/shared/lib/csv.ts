/**
 * Parser & serializer CSV sederhana (RFC 4180) — tanpa dependensi.
 * Dipakai untuk impor/ekspor produk (Sub-PRD 4.2, PRD-06).
 */

export type CsvCell = string | number | null | undefined;

/**
 * Parse teks CSV menjadi baris sel.
 * - Mendukung tanda kutip ganda, kutip di dalam kutip (""),
 *   pemisah koma, baris CRLF/LF, dan BOM UTF-8.
 * - Baris kosong terakhir akibat newline di akhir file dibuang.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && field === "") {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && src[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialize baris sel menjadi teks CSV (CRLF, diakhiri newline). */
export function toCsv(rows: readonly CsvCell[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

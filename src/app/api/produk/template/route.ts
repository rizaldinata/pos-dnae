import ExcelJS from "exceljs";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { IMPORT_COLUMNS } from "@/modules/catalog/domain/services/import-policy";
import { toCsv } from "@/shared/lib/csv";

export const dynamic = "force-dynamic";

const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";
const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const GUIDE_LINES = [
  "Petunjuk Impor Produk (PRD-06)",
  "",
  "1. Isi baris data di sheet Template, tepat di bawah baris header. Satu baris = satu varian produk.",
  "2. Kolom wajib: Nama, SKU, Harga Modal, Harga Jual. Kolom lain opsional.",
  "3. SKU wajib unik — harus berbeda dari data yang sudah ada maupun antar baris dalam file.",
  "4. Barcode opsional; bila diisi harus unik (maksimal 50 karakter).",
  "5. Harga boleh memakai format Indonesia (15.000) atau internasional (15000).",
  "6. Kategori, brand, dan satuan dicocokkan dulu; bila belum ada, sistem membuat baru.",
  "7. Baris dengan nama + kategori + brand + satuan yang sama digabung menjadi satu produk multi-varian.",
  "8. Nomor baris pada pesan error mengacu ke nomor baris pada file asli.",
  "9. Maksimal 1000 baris data per file.",
  "10. Bisa juga mengimpor ulang hasil Ekspor CSV/Excel dari halaman Produk.",
];

function labelHeaders(): string[] {
  return IMPORT_COLUMNS.map(
    (col) => col.label.charAt(0).toUpperCase() + col.label.slice(1)
  );
}

/**
 * Template impor produk (PRD-06): CSV = baris header saja; XLSX = sheet
 * Template (header + format teks untuk SKU/barcode) + sheet Petunjuk.
 */
export async function GET(request: Request) {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    return Response.json({ message: guard.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  if (format === "csv") {
    const csv = "\uFEFF" + toCsv([labelHeaders()]);
    return new Response(csv, {
      headers: {
        "Content-Type": CSV_CONTENT_TYPE,
        "Content-Disposition":
          'attachment; filename="template-impor-produk.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Template");
  sheet.columns = IMPORT_COLUMNS.map((col) => ({
    width: col.key === "name" || col.key === "variantName" ? 28 : 14,
  }));

  const headerRow = sheet.addRow(labelHeaders());
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
  });

  // SKU & barcode sebagai teks agar angka nol di depan tidak hilang saat diedit.
  for (const key of ["sku", "barcode"] as const) {
    const index = IMPORT_COLUMNS.findIndex((col) => col.key === key);
    if (index >= 0) {
      sheet.getColumn(index + 1).numFmt = "@";
    }
  }

  const guide = workbook.addWorksheet("Petunjuk");
  guide.getColumn(1).width = 120;
  for (const line of GUIDE_LINES) {
    guide.addRow([line]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as unknown as ArrayBuffer), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition":
        'attachment; filename="template-impor-produk.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

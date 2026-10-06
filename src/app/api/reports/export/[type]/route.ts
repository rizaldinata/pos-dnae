import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import {
  EXPORT_PERMISSIONS,
  isExportType,
  loadExportDataset,
} from "@/modules/reporting/presentation/export/dataset";
import { datasetToCsv } from "@/modules/reporting/presentation/export/csv";
import { buildExcelBuffer } from "@/modules/reporting/presentation/export/excel";
import { loadExportStore } from "@/modules/reporting/presentation/export/store";
import { isErr } from "@/shared/kernel/result";

export const dynamic = "force-dynamic";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  if (!isExportType(type)) {
    return Response.json(
      { message: "Tipe ekspor tidak dikenal" },
      { status: 404 }
    );
  }

  const guard = await requirePermission(EXPORT_PERMISSIONS[type]);
  if (!guard.ok) {
    return Response.json({ message: guard.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const dataset = await loadExportDataset(type, url.searchParams);
  if (isErr(dataset)) {
    return Response.json({ message: dataset.error.message }, { status: 400 });
  }

  // PRD-06: format CSV polos (tanpa judul toko) agar bisa diimpor ulang.
  if (url.searchParams.get("format") === "csv") {
    return new Response(datasetToCsv(dataset.data), {
      headers: {
        "Content-Type": CSV_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${dataset.data.filename}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const store = await loadExportStore();
  const buffer = await buildExcelBuffer(dataset.data, store);
  const filename = `${dataset.data.filename}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

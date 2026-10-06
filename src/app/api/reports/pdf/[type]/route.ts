import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import {
  EXPORT_PERMISSIONS,
  isPdfType,
  loadExportDataset,
} from "@/modules/reporting/presentation/export/dataset";
import { buildPdfBuffer } from "@/modules/reporting/presentation/export/pdf";
import { loadExportStore } from "@/modules/reporting/presentation/export/store";
import { isErr } from "@/shared/kernel/result";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  if (!isPdfType(type)) {
    return Response.json(
      { message: "Tipe PDF tidak dikenal" },
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

  const store = await loadExportStore();
  const buffer = await buildPdfBuffer(dataset.data, store);
  const filename = `${dataset.data.filename}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

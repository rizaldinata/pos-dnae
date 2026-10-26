import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";

export const dynamic = "force-dynamic";

const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/storefront/orders/[orderNo]/proof — pelanggan mengunggah bukti
 * bayar QRIS (multipart/form-data, field "file"). Hanya pesanan QRIS yang
 * masih berstatus pending.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  const { orderNo } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { message: 'Form tidak valid — kirim berkas dengan field "file"' },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { message: "Berkas bukti pembayaran belum dipilih" },
      { status: 400 }
    );
  }
  if (file.size === 0 || file.size > MAX_PROOF_BYTES) {
    return Response.json(
      { message: "Ukuran berkas maksimal 5 MB" },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const container = await getAppContainer();
  const result = await container.orders.attachPaymentProof.execute({
    orderNo,
    bytes,
    contentType: file.type,
  });
  if (isErr(result)) {
    const status = result.error.message.includes("tidak ditemukan") ? 404 : 400;
    return Response.json(
      { message: result.error.message, code: result.error.code },
      { status }
    );
  }

  return Response.json({ ok: true, path: result.data }, { status: 201 });
}

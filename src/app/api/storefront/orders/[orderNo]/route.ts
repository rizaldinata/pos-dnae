import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import { ORDER_STATUS_LABELS } from "@/modules/orders/domain/entities/order";

export const dynamic = "force-dynamic";

/**
 * GET /api/storefront/orders/[orderNo]?phone=... — status pesanan untuk
 * pelanggan. No. HP wajib cocok dengan pemesan (verifikasi kepemilikan).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  const { orderNo } = await params;
  const phone = new URL(request.url).searchParams.get("phone") ?? "";
  if (!phone.trim()) {
    return Response.json(
      { message: "Nomor HP wajib diisi untuk mengecek pesanan" },
      { status: 400 }
    );
  }

  const container = await getAppContainer();
  const result = await container.orders.getOrderStatus.execute(orderNo, phone);
  if (isErr(result)) {
    return Response.json({ message: result.error.message }, { status: 404 });
  }

  const order = result.data;
  return Response.json({
    orderNo: order.orderNo,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    customerName: order.customerName,
    fulfillment: order.fulfillment,
    paymentType: order.paymentType,
    paymentProofAttached: order.paymentProofPath !== "",
    total: order.total,
    itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
  });
}

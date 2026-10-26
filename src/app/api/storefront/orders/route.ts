import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";

export const dynamic = "force-dynamic";

/**
 * POST /api/storefront/orders — membuat pesanan online dari halaman publik.
 * Tanpa login; validasi & stok dijaga use case + fungsi DB (atomik).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Body tidak valid" }, { status: 400 });
  }

  const container = await getAppContainer();
  const result = await container.orders.placeOrder.execute(body);
  if (isErr(result)) {
    const code = result.error.code;
    const status =
      code === "OUT_OF_STOCK" || code === "PRODUCT_UNAVAILABLE" ? 409 : 400;
    return Response.json({ message: result.error.message, code }, { status });
  }

  return Response.json(
    {
      orderNo: result.data.orderNo,
      total: result.data.total,
      createdAt: result.data.createdAt,
    },
    { status: 201 }
  );
}

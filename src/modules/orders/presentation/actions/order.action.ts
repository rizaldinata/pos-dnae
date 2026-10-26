"use server";

import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import type {
  OnlineOrder,
  OnlineOrderSummary,
  OrderFulfillment,
  OrderItem,
  OrderPaymentType,
  OrderStatus,
} from "@/modules/orders/domain/entities/order";

export interface OrderItemDTO {
  variantId: string;
  productName: string;
  variantName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderListItemDTO {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  fulfillment: OrderFulfillment;
  paymentType: OrderPaymentType;
  status: OrderStatus;
  total: number;
  itemCount: number;
  totalQty: number;
  hasProof: boolean;
  createdAt: string;
}

export interface OrderDetailDTO extends OrderListItemDTO {
  address: string;
  note: string;
  cancelReason: string;
  items: OrderItemDTO[];
  /** Signed URL bukti bayar QRIS (1 jam); null bila tidak ada/gagal. */
  proofUrl: string | null;
}

export interface ListOrdersState {
  success: boolean;
  message: string | null;
  items: OrderListItemDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderActionState {
  success: boolean;
  message: string | null;
  order: OrderDetailDTO | null;
}

function toListItem(summary: OnlineOrderSummary): OrderListItemDTO {
  return {
    id: summary.id,
    orderNo: summary.orderNo,
    customerName: summary.customerName,
    customerPhone: summary.customerPhone,
    fulfillment: summary.fulfillment,
    paymentType: summary.paymentType,
    status: summary.status,
    total: summary.total,
    itemCount: summary.itemCount,
    totalQty: summary.totalQty,
    hasProof: summary.paymentProofPath !== "",
    createdAt: summary.createdAt,
  };
}

function toItemDTO(item: OrderItem): OrderItemDTO {
  return {
    variantId: item.variantId,
    productName: item.productName,
    variantName: item.variantName,
    qty: item.qty,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  };
}

async function toDetailDTO(
  order: OnlineOrder,
  proofUrl: string | null
): Promise<OrderDetailDTO> {
  return {
    ...toListItem({
      ...order,
      itemCount: order.items.length,
      totalQty: order.items.reduce((sum, item) => sum + item.qty, 0),
    }),
    address: order.address,
    note: order.note,
    cancelReason: order.cancelReason,
    items: order.items.map(toItemDTO),
    proofUrl,
  };
}

/** Daftar pesanan online untuk halaman staf. */
export async function listOrdersAction(query: {
  status?: OrderStatus | null;
  search?: string | null;
  page?: number;
}): Promise<ListOrdersState> {
  const guard = await requirePermission("order.manage");
  if (!guard.ok) {
    return {
      success: false,
      message: guard.message,
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };
  }
  const container = await getAppContainer();
  const result = await container.orders.listOrders.execute({
    status: query.status ?? null,
    search: query.search ?? null,
    page: query.page ?? 1,
  });
  if (isErr(result)) {
    return {
      success: false,
      message: result.error.message,
      items: [],
      total: 0,
      page: query.page ?? 1,
      pageSize: 20,
    };
  }
  return {
    success: true,
    message: null,
    items: result.data.items.map(toListItem),
    total: result.data.total,
    page: query.page ?? 1,
    pageSize: 20,
  };
}

/** Detail pesanan (termasuk item + bukti bayar via signed URL). */
export async function getOrderDetailAction(
  orderId: string
): Promise<OrderActionState> {
  const guard = await requirePermission("order.manage");
  if (!guard.ok) {
    return { success: false, message: guard.message, order: null };
  }
  const container = await getAppContainer();
  const result = await container.orders.getOrderDetail.execute(orderId);
  if (isErr(result)) {
    return { success: false, message: result.error.message, order: null };
  }
  return {
    success: true,
    message: null,
    order: await toDetailDTO(result.data.order, result.data.proofUrl),
  };
}

export async function updateOrderStatusAction(input: {
  orderId: string;
  expectedStatus: OrderStatus;
  nextStatus: OrderStatus;
}): Promise<OrderActionState> {
  const guard = await requirePermission("order.manage");
  if (!guard.ok) {
    return { success: false, message: guard.message, order: null };
  }
  const container = await getAppContainer();
  const result = await container.orders.updateOrderStatus.execute(
    input,
    guard.user.id
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message, order: null };
  }
  return {
    success: true,
    message: "Status pesanan diperbarui",
    order: await toDetailDTO(result.data, null),
  };
}

export async function cancelOrderAction(input: {
  orderId: string;
  reason?: string;
}): Promise<OrderActionState> {
  const guard = await requirePermission("order.manage");
  if (!guard.ok) {
    return { success: false, message: guard.message, order: null };
  }
  const container = await getAppContainer();
  const result = await container.orders.cancelOrder.execute(
    input,
    guard.user.id
  );
  if (isErr(result)) {
    return { success: false, message: result.error.message, order: null };
  }
  return {
    success: true,
    message: "Pesanan dibatalkan dan stok dikembalikan",
    order: await toDetailDTO(result.data, null),
  };
}

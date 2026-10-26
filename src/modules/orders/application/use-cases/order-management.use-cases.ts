import { err, ok, type Result } from "@/shared/kernel/result";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import type { z } from "zod";
import type { OnlineOrder } from "../../domain/entities/order";
import { canTransition } from "../../domain/entities/order";
import {
  InvalidOrderTransitionError,
  OrderNotFoundError,
  PaymentProofError,
} from "../../domain/errors";
import type {
  IOrderRepository,
  ListOrdersResult,
} from "../../domain/repositories/order.repository";
import {
  CancelOrderSchema,
  ListOrdersQuerySchema,
  ProofUploadSchema,
  UpdateOrderStatusSchema,
} from "../dto/order.dto";

const PAGE_SIZE = 20;

function toValidationError(error: z.ZodError): ValidationError {
  return new ValidationError(
    "Data tidak valid",
    Object.fromEntries(
      error.issues.map((issue) => [
        issue.path.join(".") || "form",
        [issue.message],
      ])
    )
  );
}

/** Daftar pesanan untuk halaman staf (filter status + pencarian no. pesanan/HP). */
export class ListOrdersUseCase {
  constructor(private readonly orders: IOrderRepository) {}

  public async execute(
    raw: unknown
  ): Promise<Result<ListOrdersResult, DomainError>> {
    const parsed = ListOrdersQuerySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return err(toValidationError(parsed.error));
    }
    return this.orders.listOrders({
      status: parsed.data.status ?? null,
      search: parsed.data.search ?? null,
      page: parsed.data.page ?? 1,
      pageSize: PAGE_SIZE,
    });
  }
}

/** Mengubah status pesanan (pending → confirmed → ready → completed). */
export class UpdateOrderStatusUseCase {
  constructor(private readonly orders: IOrderRepository) {}

  public async execute(
    raw: unknown,
    actorId: string
  ): Promise<Result<OnlineOrder, DomainError>> {
    const parsed = UpdateOrderStatusSchema.safeParse(raw);
    if (!parsed.success) {
      return err(toValidationError(parsed.error));
    }
    const { orderId, expectedStatus, nextStatus } = parsed.data;
    if (!canTransition(expectedStatus, nextStatus)) {
      return err(new InvalidOrderTransitionError(expectedStatus, nextStatus));
    }
    return this.orders.updateStatus(
      orderId,
      expectedStatus,
      nextStatus,
      actorId
    );
  }
}

/** Membatalkan pesanan + mengembalikan stok (pending/confirmed/ready). */
export class CancelOrderUseCase {
  constructor(private readonly orders: IOrderRepository) {}

  public async execute(
    raw: unknown,
    actorId: string
  ): Promise<Result<OnlineOrder, DomainError>> {
    const parsed = CancelOrderSchema.safeParse(raw);
    if (!parsed.success) {
      return err(toValidationError(parsed.error));
    }
    return this.orders.cancelOrder(
      parsed.data.orderId,
      parsed.data.reason,
      actorId
    );
  }
}

/**
 * Detail pesanan untuk staf, termasuk signed URL bukti bayar QRIS
 * (berlaku 1 jam; null bila tidak ada bukti).
 */
export class GetOrderDetailUseCase {
  constructor(private readonly orders: IOrderRepository) {}

  public async execute(
    orderId: string
  ): Promise<
    Result<{ order: OnlineOrder; proofUrl: string | null }, DomainError>
  > {
    const found = await this.orders.findById(orderId);
    if (!found.success) {
      return err(found.error);
    }
    if (!found.data) {
      return err(new OrderNotFoundError());
    }
    let proofUrl: string | null = null;
    if (found.data.paymentProofPath) {
      const signed = await this.orders.createProofSignedUrl(
        found.data.paymentProofPath
      );
      proofUrl = signed.success ? signed.data : null;
    }
    return ok({ order: found.data, proofUrl });
  }
}

/** Pelanggan mengunggah bukti bayar QRIS; hanya untuk pesanan pending. */
export class AttachPaymentProofUseCase {
  constructor(private readonly orders: IOrderRepository) {}

  public async execute(raw: unknown): Promise<Result<string, DomainError>> {
    const parsed = ProofUploadSchema.safeParse(raw);
    if (!parsed.success) {
      return err(toValidationError(parsed.error));
    }
    const { orderNo, bytes, contentType } = parsed.data;
    const found = await this.orders.findByOrderNo(orderNo);
    if (!found.success) {
      return err(found.error);
    }
    const order = found.data;
    if (!order) {
      return err(new PaymentProofError("Pesanan tidak ditemukan"));
    }
    if (order.paymentType !== "qris") {
      return err(
        new PaymentProofError(
          "Pesanan ini bukan pembayaran QRIS — tidak perlu unggah bukti"
        )
      );
    }
    if (order.status !== "pending") {
      return err(
        new PaymentProofError(
          "Bukti hanya dapat diunggah selama pesanan masih menunggu verifikasi"
        )
      );
    }
    const uploaded = await this.orders.uploadPaymentProof(orderNo, {
      bytes,
      contentType,
    });
    if (!uploaded.success) {
      return err(uploaded.error);
    }
    const attached = await this.orders.attachPaymentProof(
      order.id,
      uploaded.data
    );
    if (!attached.success) {
      return err(attached.error);
    }
    return ok(uploaded.data);
  }
}

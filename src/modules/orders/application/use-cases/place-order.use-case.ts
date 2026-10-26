import { err, ok, type Result } from "@/shared/kernel/result";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { mapPlaceOrderFailure, PlaceOrderError } from "../../domain/errors";
import type { PlacedOrder } from "../../domain/entities/order";
import type { IOrderRepository } from "../../domain/repositories/order.repository";
import { PlaceOrderSchema, type PlaceOrderData } from "../dto/place-order.dto";

/**
 * Membuat pesanan online dari halaman publik (tanpa login).
 * Validasi dilakukan dua lapis: schema zod di aplikasi + fungsi DB
 * (stok, produk aktif) secara atomik.
 */
export class PlaceOrderUseCase {
  constructor(private readonly orders: IOrderRepository) {}

  public async execute(
    raw: unknown
  ): Promise<Result<PlacedOrder, DomainError>> {
    const parsed = PlaceOrderSchema.safeParse(raw);
    if (!parsed.success) {
      return err(
        new ValidationError(
          "Data pesanan tidak valid",
          Object.fromEntries(
            parsed.error.issues.map((issue) => [
              issue.path.join(".") || "form",
              [issue.message],
            ])
          )
        )
      );
    }
    const data: PlaceOrderData = parsed.data;
    const placed = await this.orders.placeOrder({
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      fulfillment: data.fulfillment,
      address: data.address,
      note: data.note,
      paymentType: data.paymentType,
      items: data.items,
    });
    if (!placed.success) {
      // Kode error RPC diterjemahkan ke pesan yang aman untuk pelanggan.
      const code = placed.error.message;
      return err(mapPlaceOrderFailure(code));
    }
    if (!placed.data.orderNo) {
      return err(new PlaceOrderError());
    }
    return ok(placed.data);
  }
}

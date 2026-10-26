import { err, ok, type Result } from "@/shared/kernel/result";
import { type DomainError } from "@/shared/kernel/errors";
import type {
  OnlineOrder,
  StorefrontProduct,
  StorefrontSettings,
} from "../../domain/entities/order";
import type { IOrderRepository } from "../../domain/repositories/order.repository";
import type { IStorefrontCatalogPort } from "../../domain/repositories/storefront-catalog.port";
import { OrderNotFoundError } from "../../domain/errors";

export interface StorefrontData {
  products: StorefrontProduct[];
  settings: StorefrontSettings;
}

/** Data landing page: katalog produk aktif + pengaturan toko. */
export class GetStorefrontDataUseCase {
  constructor(private readonly catalog: IStorefrontCatalogPort) {}

  public async execute(): Promise<Result<StorefrontData, DomainError>> {
    const products = await this.catalog.listProducts();
    if (!products.success) {
      return err(products.error);
    }
    const settings = await this.catalog.getSettings();
    if (!settings.success) {
      return err(settings.error);
    }
    return ok({ products: products.data, settings: settings.data });
  }
}

/** Pengaturan toko saja (halaman status pesanan, tanpa katalog). */
export class GetStorefrontSettingsUseCase {
  constructor(private readonly catalog: IStorefrontCatalogPort) {}

  public async execute(): Promise<Result<StorefrontSettings, DomainError>> {
    return this.catalog.getSettings();
  }
}

/**
 * Status pesanan untuk pelanggan: verifikasi no. HP pemilik pesanan
 * agar nomor pesanan saja tidak cukup untuk membuka data pelanggan lain.
 */
export class GetOrderStatusUseCase {
  constructor(private readonly orders: IOrderRepository) {}

  public async execute(
    orderNo: string,
    phone: string
  ): Promise<Result<OnlineOrder, DomainError>> {
    const normalizedPhone = (raw: string): string =>
      raw.replace(/[\s\-().]/g, "");
    const found = await this.orders.findByOrderNo(orderNo.trim());
    if (!found.success) {
      return err(found.error);
    }
    if (
      !found.data ||
      normalizedPhone(found.data.customerPhone) !== normalizedPhone(phone)
    ) {
      return err(new OrderNotFoundError(orderNo.trim() || undefined));
    }
    return ok(found.data);
  }
}

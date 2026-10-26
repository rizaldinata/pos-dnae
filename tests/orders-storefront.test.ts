import { describe, expect, it } from "vitest";
import { PlaceOrderSchema } from "@/modules/orders/application/dto/place-order.dto";
import {
  canTransition,
  nextStatuses,
} from "@/modules/orders/domain/entities/order";
import {
  mapPlaceOrderFailure,
  OutOfStockError,
  OrderNotFoundError,
} from "@/modules/orders/domain/errors";
import { PlaceOrderUseCase } from "@/modules/orders/application/use-cases/place-order.use-case";
import {
  GetOrderStatusUseCase,
  GetStorefrontDataUseCase,
} from "@/modules/orders/application/use-cases/storefront.use-cases";
import {
  CancelOrderUseCase,
  UpdateOrderStatusUseCase,
} from "@/modules/orders/application/use-cases/order-management.use-cases";
import type {
  IOrderRepository,
  PlaceOrderRecord,
} from "@/modules/orders/domain/repositories/order.repository";
import type { IStorefrontCatalogPort } from "@/modules/orders/domain/repositories/storefront-catalog.port";
import type {
  OnlineOrder,
  PlacedOrder,
  StorefrontProduct,
  StorefrontSettings,
} from "@/modules/orders/domain/entities/order";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { err, ok, type Result } from "@/shared/kernel/result";

const VARIANT_ID = "e0000000-0000-4000-8000-000000000001";

const BASE_ORDER = {
  customerName: "Budi",
  customerPhone: "0812 3456 7890",
  fulfillment: "pickup" as const,
  paymentType: "cod" as const,
  items: [{ variantId: VARIANT_ID, qty: 2 }],
};

const PLACED: PlacedOrder = {
  id: "10000000-0000-4000-8000-000000000001",
  orderNo: "ORD-20261015-0001",
  subtotal: 137000,
  total: 137000,
  createdAt: "2026-10-15T10:00:00+07:00",
};

const STOREFRONT_PRODUCT: StorefrontProduct = {
  productId: "10000000-0000-4000-8000-000000000009",
  name: "Beras Premium",
  description: "",
  imageUrl: "",
  categoryName: "Sembako",
  variants: [
    { id: VARIANT_ID, name: "5 kg", sellPrice: 68500, isAvailable: true },
  ],
};

const STOREFRONT_SETTINGS: StorefrontSettings = {
  storeName: "Toko DNAE",
  storeAddress: "Jl. Contoh",
  storePhone: "021-1234",
  storeLogoUrl: "",
  qrisImagePath: "",
};

function makeOrder(overrides: Partial<OnlineOrder> = {}): OnlineOrder {
  return {
    id: PLACED.id,
    orderNo: PLACED.orderNo,
    customerName: "Budi",
    customerPhone: "0812 3456 7890",
    fulfillment: "pickup",
    address: "",
    note: "",
    paymentType: "cod",
    paymentProofPath: "",
    status: "pending",
    subtotal: PLACED.total,
    total: PLACED.total,
    cancelReason: "",
    processedBy: null,
    processedAt: null,
    createdAt: PLACED.createdAt,
    updatedAt: PLACED.createdAt,
    items: [
      {
        variantId: VARIANT_ID,
        productName: "Beras Premium",
        variantName: "5 kg",
        qty: 2,
        unitPrice: 68500,
        lineTotal: 137000,
      },
    ],
    ...overrides,
  };
}

/** Stub repository: hanya method yang dipakai use case diuji. */
function stubRepo(overrides: Partial<IOrderRepository> = {}): IOrderRepository {
  const fail = new Error("method tidak di-stub");
  return {
    placeOrder: () => Promise.reject(fail),
    findByOrderNo: () => Promise.reject(fail),
    findById: () => Promise.reject(fail),
    listOrders: () => Promise.reject(fail),
    updateStatus: () => Promise.reject(fail),
    cancelOrder: () => Promise.reject(fail),
    attachPaymentProof: () => Promise.reject(fail),
    uploadPaymentProof: () => Promise.reject(fail),
    createProofSignedUrl: () => Promise.reject(fail),
    ...overrides,
  } as IOrderRepository;
}

describe("PlaceOrderSchema", () => {
  it("menerima pesanan pickup cod yang valid", () => {
    expect(PlaceOrderSchema.safeParse(BASE_ORDER).success).toBe(true);
  });

  it("menerima pesanan delivery dengan alamat", () => {
    const parsed = PlaceOrderSchema.safeParse({
      ...BASE_ORDER,
      fulfillment: "delivery",
      address: "Jl. Merdeka No. 1, Jakarta",
    });
    expect(parsed.success).toBe(true);
  });

  it("menolak delivery tanpa alamat", () => {
    const parsed = PlaceOrderSchema.safeParse({
      ...BASE_ORDER,
      fulfillment: "delivery",
      address: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("menolak item kosong dan qty di luar batas", () => {
    expect(
      PlaceOrderSchema.safeParse({ ...BASE_ORDER, items: [] }).success
    ).toBe(false);
    expect(
      PlaceOrderSchema.safeParse({
        ...BASE_ORDER,
        items: [{ variantId: VARIANT_ID, qty: 0 }],
      }).success
    ).toBe(false);
    expect(
      PlaceOrderSchema.safeParse({
        ...BASE_ORDER,
        items: [{ variantId: VARIANT_ID, qty: 100 }],
      }).success
    ).toBe(false);
    expect(
      PlaceOrderSchema.safeParse({
        ...BASE_ORDER,
        items: [{ variantId: VARIANT_ID, qty: 1.5 }],
      }).success
    ).toBe(false);
  });

  it("menolak varian duplikat (qty harus digabung di klien)", () => {
    const parsed = PlaceOrderSchema.safeParse({
      ...BASE_ORDER,
      items: [
        { variantId: VARIANT_ID, qty: 1 },
        { variantId: VARIANT_ID, qty: 2 },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("menolak nomor HP yang tidak valid", () => {
    for (const customerPhone of ["", "abc", "12345"]) {
      const parsed = PlaceOrderSchema.safeParse({
        ...BASE_ORDER,
        customerPhone,
      });
      expect(parsed.success).toBe(false);
    }
  });
});

describe("alur status pesanan", () => {
  it("hanya mengizinkan transisi maju yang sah", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "ready")).toBe(true);
    expect(canTransition("ready", "completed")).toBe(true);
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("ready", "cancelled")).toBe(true);
    expect(canTransition("pending", "ready")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });

  it("status akhir tidak punya transisi berikutnya", () => {
    expect(nextStatuses("completed")).toHaveLength(0);
    expect(nextStatuses("cancelled")).toHaveLength(0);
  });
});

describe("mapPlaceOrderFailure", () => {
  it("memetakan kode RPC ke pesan yang aman untuk pelanggan", () => {
    expect(mapPlaceOrderFailure("OUT_OF_STOCK")).toBeInstanceOf(
      OutOfStockError
    );
    expect(mapPlaceOrderFailure("OUT_OF_STOCK").message).toMatch(/stok/i);
    expect(mapPlaceOrderFailure("VARIANT_INACTIVE").message).toMatch(
      /sudah tidak tersedia/i
    );
    expect(mapPlaceOrderFailure("INVALID_PHONE").message).toMatch(/nomor hp/i);
    expect(mapPlaceOrderFailure("SOMETHING_ELSE").message).toBeTruthy();
  });
});

describe("PlaceOrderUseCase", () => {
  it("mengembalikan ValidationError untuk payload rusak", async () => {
    const useCase = new PlaceOrderUseCase(stubRepo());
    const result = await useCase.execute({ customerName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("meneruskan hasil sukses dari repository", async () => {
    const useCase = new PlaceOrderUseCase(
      stubRepo({
        placeOrder: (record: PlaceOrderRecord) => {
          expect(record.customerPhone).toBe("0812 3456 7890");
          expect(record.items).toEqual([{ variantId: VARIANT_ID, qty: 2 }]);
          return Promise.resolve(ok(PLACED)) as Promise<
            Result<PlacedOrder, DomainError>
          >;
        },
      })
    );
    const result = await useCase.execute(BASE_ORDER);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderNo).toBe("ORD-20261015-0001");
      expect(result.data.total).toBe(137000);
    }
  });

  it("menerjemahkan kode error RPC ke DomainError pelanggan", async () => {
    const useCase = new PlaceOrderUseCase(
      stubRepo({
        placeOrder: () =>
          Promise.resolve(err(new Error("OUT_OF_STOCK"))) as Promise<
            Result<PlacedOrder, DomainError>
          >,
      })
    );
    const result = await useCase.execute(BASE_ORDER);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OutOfStockError);
    }
  });
});

describe("GetOrderStatusUseCase", () => {
  it("mencocokkan no. HP dengan toleransi spasi/strip", async () => {
    const useCase = new GetOrderStatusUseCase(
      stubRepo({
        findByOrderNo: () =>
          Promise.resolve(ok(makeOrder())) as Promise<
            Result<OnlineOrder | null, DomainError>
          >,
      })
    );
    const result = await useCase.execute("ORD-20261015-0001", "0812-3456-7890");
    expect(result.success).toBe(true);
  });

  it("menolak akses bila no. HP tidak cocok (tiru hasil tidak ditemukan)", async () => {
    const useCase = new GetOrderStatusUseCase(
      stubRepo({
        findByOrderNo: () =>
          Promise.resolve(ok(makeOrder())) as Promise<
            Result<OnlineOrder | null, DomainError>
          >,
      })
    );
    const result = await useCase.execute("ORD-20261015-0001", "0899999999");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(OrderNotFoundError);
    }
  });
});

describe("UpdateOrderStatusUseCase & CancelOrderUseCase", () => {
  it("menolak transisi yang tidak sah tanpa menyentuh repository", async () => {
    const useCase = new UpdateOrderStatusUseCase(stubRepo());
    const result = await useCase.execute(
      {
        orderId: PLACED.id,
        expectedStatus: "pending",
        nextStatus: "completed",
      },
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_ORDER_TRANSITION");
    }
  });

  it("meneruskan pembatalan ke repository dengan alasan", async () => {
    const useCase = new CancelOrderUseCase(
      stubRepo({
        cancelOrder: (id, reason, actor) => {
          expect(id).toBe(PLACED.id);
          expect(reason).toBe("Stok habis");
          expect(actor).toBe("user-1");
          return Promise.resolve(
            ok(makeOrder({ status: "cancelled", cancelReason: reason }))
          ) as Promise<Result<OnlineOrder, DomainError>>;
        },
      })
    );
    const result = await useCase.execute(
      { orderId: PLACED.id, reason: "Stok habis" },
      "user-1"
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("cancelled");
    }
  });
});

describe("GetStorefrontDataUseCase", () => {
  it("menggabungkan katalog + pengaturan toko", async () => {
    const catalog: IStorefrontCatalogPort = {
      listProducts: () =>
        Promise.resolve(ok([STOREFRONT_PRODUCT])) as Promise<
          Result<StorefrontProduct[], DomainError>
        >,
      getSettings: () =>
        Promise.resolve(ok(STOREFRONT_SETTINGS)) as Promise<
          Result<StorefrontSettings, DomainError>
        >,
    };
    const useCase = new GetStorefrontDataUseCase(catalog);
    const result = await useCase.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.products).toHaveLength(1);
      expect(result.data.settings.storeName).toBe("Toko DNAE");
    }
  });
});

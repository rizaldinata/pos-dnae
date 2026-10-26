import { describe, expect, it } from "vitest";
import { CheckoutSchema } from "@/modules/sales/application/dto/checkout.dto";
import { SendReceiptNotificationUseCase } from "@/modules/sales/application/use-cases/send-receipt-notification.use-case";
import {
  WahaReceiptSender,
  toWaChatId,
} from "@/modules/sales/infrastructure/waha-receipt-sender";
import type {
  IReceiptSender,
  ReceiptPortPayload,
} from "@/modules/sales/application/ports/receipt-sender.port";
import type { ISaleRepository } from "@/modules/sales/domain/repositories/sale.repository";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import type { SaleReceipt } from "@/modules/sales/domain/entities/sale";
import { Sale, SaleItem } from "@/modules/sales/domain/entities/sale";
import {
  ReceiptSendError,
  SaleNotFoundError,
} from "@/modules/sales/domain/errors";
import { ValidationError, type DomainError } from "@/shared/kernel/errors";
import { isErr, ok, err, type Result } from "@/shared/kernel/result";
import { Money } from "@/shared/lib/money";

const BASE_CHECKOUT = {
  items: [{ variantId: "e0000000-0000-4000-8000-000000000005", qty: 1 }],
};

describe("CheckoutSchema.customerPhone", () => {
  it("menerima transaksi tanpa no. HP (opsional)", () => {
    const parsed = CheckoutSchema.safeParse(BASE_CHECKOUT);
    expect(parsed.success).toBe(true);
  });

  it("menerima null", () => {
    const parsed = CheckoutSchema.safeParse({
      ...BASE_CHECKOUT,
      customerPhone: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("menerima format HP lokal dan internasional", () => {
    for (const phone of [
      "0812 3456 7890",
      "0812-3456-7890",
      "+62 812-3456-7890",
      "(0812) 34567890",
    ]) {
      const parsed = CheckoutSchema.safeParse({
        ...BASE_CHECKOUT,
        customerPhone: phone,
      });
      expect(parsed.success, phone).toBe(true);
    }
  });

  it("menolak nomor yang tidak valid", () => {
    for (const phone of ["abc", "123", "0812"]) {
      const parsed = CheckoutSchema.safeParse({
        ...BASE_CHECKOUT,
        customerPhone: phone,
      });
      expect(parsed.success, phone).toBe(false);
    }
  });
});

describe("toWaChatId", () => {
  it("mengonversi berbagai format ke chatId WhatsApp", () => {
    expect(toWaChatId("0812 3456 7890")).toBe("6281234567890@c.us");
    expect(toWaChatId("+62 812-3456-7890")).toBe("6281234567890@c.us");
    expect(toWaChatId("6281234567890")).toBe("6281234567890@c.us");
    expect(toWaChatId("81234567890")).toBe("6281234567890@c.us");
  });
});

describe("WahaReceiptSender", () => {
  it("menolak bila WAHA_URL belum dikonfigurasi", async () => {
    const sender = new WahaReceiptSender({ baseUrl: "" });
    const result = await sender.send({ to: "081234567890", text: "halo" });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBeInstanceOf(ReceiptSendError);
      expect(result.error.message).toContain("WAHA_URL");
    }
  });

  it("mengirim POST /api/sendText dengan chatId, text, session, dan X-Api-Key", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Promise.resolve({ ok: true, status: 200 } as Response);
    };
    const sender = new WahaReceiptSender(
      {
        baseUrl: "https://waha.example/",
        apiKey: "secret-key",
        session: "kasir-1",
      },
      fakeFetch as unknown as typeof fetch
    );

    const result = await sender.send({
      to: "0812 3456 7890",
      text: "Struk INV-1",
    });

    expect(result.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://waha.example/api/sendText");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Api-Key": "secret-key",
    });
    expect(JSON.parse(String(calls[0]?.init.body ?? ""))).toEqual({
      chatId: "6281234567890@c.us",
      text: "Struk INV-1",
      session: "kasir-1",
    });
  });

  it("meneruskan error HTTP dari WAHA", async () => {
    const fakeFetch = () =>
      Promise.resolve({ ok: false, status: 500 } as Response);
    const sender = new WahaReceiptSender(
      { baseUrl: "http://localhost:3002" },
      fakeFetch as unknown as typeof fetch
    );
    const result = await sender.send({ to: "081234567890", text: "x" });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain("HTTP 500");
    }
  });

  it("meneruskan kegagalan jaring", async () => {
    const fakeFetch = () => Promise.reject(new Error("ECONNREFUSED"));
    const sender = new WahaReceiptSender(
      { baseUrl: "http://localhost:3002" },
      fakeFetch as unknown as typeof fetch
    );
    const result = await sender.send({ to: "081234567890", text: "x" });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain("ECONNREFUSED");
    }
  });
});

describe("SendReceiptNotificationUseCase", () => {
  function makeReceipt(phone: string | null): SaleReceipt {
    const sale = Sale.create(
      {
        invoiceNo: "INV-20261012-0001",
        idempotencyKey: "key-1",
        shiftId: null,
        userId: "u-1",
        customerId: null,
        customerPhone: phone,
        subtotal: Money.create(70000),
        discountTotal: Money.create(0),
        taxTotal: Money.create(0),
        serviceFee: Money.create(0),
        rounding: Money.create(0),
        grandTotal: Money.create(70000),
        paidTotal: Money.create(70000),
        changeAmount: Money.create(0),
        status: "completed",
      },
      "sale-1"
    );
    const item = SaleItem.create(
      {
        saleId: "sale-1",
        variantId: null,
        productName: "Kopi Susu",
        sku: "SKU-1",
        qty: 2,
        unitPrice: Money.create(35000),
        costPrice: Money.create(20000),
        discount: Money.create(0),
        subtotal: Money.create(70000),
      },
      "item-1"
    );
    return { sale, items: [item], payments: [] };
  }

  function setup(options?: {
    receipt?: SaleReceipt | null;
    settingsOk?: boolean;
    senderResult?: Result<void, DomainError>;
  }) {
    const receipt =
      options && "receipt" in options ? options.receipt : makeReceipt("0812");
    const sales: ISaleRepository = {
      findReceiptById: async () => ok(receipt),
    } as unknown as ISaleRepository;
    const settings: ISettingsRepository = {
      getAll: async () =>
        options?.settingsOk === false
          ? err(new Error("settings down"))
          : ok({ "store.name": "Toko DNAE" }),
    } as unknown as ISettingsRepository;
    const sent: ReceiptPortPayload[] = [];
    const sender: IReceiptSender = {
      send: async (payload) => {
        sent.push(payload);
        return options?.senderResult ?? ok(undefined);
      },
    };
    return {
      useCase: new SendReceiptNotificationUseCase(sales, settings, sender),
      sent,
    };
  }

  it("mengirim pesan berisi nama toko, invoice, item, dan total", async () => {
    const { useCase, sent } = setup();
    const result = await useCase.execute("sale-1");
    expect(result.success).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("0812");
    expect(sent[0]?.text).toContain("Toko DNAE");
    expect(sent[0]?.text).toContain("INV-20261012-0001");
    expect(sent[0]?.text).toContain("2x Kopi Susu");
    expect(sent[0]?.text).toContain("Rp 70.000");
  });

  it("mengembalikan nama toko default bila settings gagal dibaca", async () => {
    const { useCase, sent } = setup({ settingsOk: false });
    const result = await useCase.execute("sale-1");
    expect(result.success).toBe(true);
    expect(sent[0]?.text).toContain("Toko\n");
  });

  it("menolak transaksi tanpa no. HP pelanggan", async () => {
    const { useCase, sent } = setup({ receipt: makeReceipt(null) });
    const result = await useCase.execute("sale-1");
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
    expect(sent).toHaveLength(0);
  });

  it("mengembalikan SaleNotFoundError untuk transaksi yang tak ditemukan", async () => {
    const { useCase } = setup({ receipt: null });
    const result = await useCase.execute("sale-1");
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBeInstanceOf(SaleNotFoundError);
    }
  });

  it("meneruskan kegagalan pengirim ke caller", async () => {
    const { useCase } = setup({
      senderResult: err(new ReceiptSendError("WAHA menolak pengiriman")),
    });
    const result = await useCase.execute("sale-1");
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain("WAHA menolak");
    }
  });
});

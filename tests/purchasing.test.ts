import { describe, expect, it } from "vitest";
import {
  CreateSupplierUseCase,
  DeleteSupplierUseCase,
  UpdateSupplierUseCase,
} from "@/modules/purchasing/application/use-cases/supplier.use-cases";
import {
  CancelPOUseCase,
  CreatePOUseCase,
  CreatePurchaseReturnUseCase,
  ReceiveGoodsUseCase,
  SendPOUseCase,
} from "@/modules/purchasing/application/use-cases/purchase-order.use-cases";
import type { ISupplierRepository } from "@/modules/purchasing/domain/repositories/supplier.repository";
import type { IPurchaseOrderRepository } from "@/modules/purchasing/domain/repositories/purchase-order.repository";
import {
  Supplier,
  PurchaseOrder,
} from "@/modules/purchasing/domain/entities/purchasing";
import { Money } from "@/shared/lib/money";
import {
  InvalidPOStatusError,
  PurchaseOrderNotFoundError,
  SupplierNotFoundError,
} from "@/modules/purchasing/domain/errors";
import { ValidationError } from "@/shared/kernel/errors";
import { ok } from "@/shared/kernel/result";
import { InvariantViolationError } from "@/shared/kernel/errors";

function makeSupplier(): Supplier {
  return Supplier.create(
    { name: "PT Maju", phone: "", address: "", paymentTermsDays: 14 },
    "sup-1"
  );
}

function makePO(
  status: "draft" | "sent" | "partial" | "completed" | "cancelled" = "draft"
): PurchaseOrder {
  return PurchaseOrder.create(
    {
      poNo: "PO-1",
      supplierId: "sup-1",
      supplierName: "PT Maju",
      status,
      orderDate: "2026-10-06",
      notes: "",
      total: Money.create(290000),
      items: [],
    },
    "po-1"
  );
}

describe("Supplier use cases", () => {
  function setup(suppliers: Supplier[]) {
    const repo: ISupplierRepository = {
      findById: async (id) => ok(suppliers.find((s) => s.id === id) ?? null),
      findAll: async () => ok(suppliers),
      create: async (record) =>
        ok(
          Supplier.create(
            { name: record.name, phone: "", address: "", paymentTermsDays: 0 },
            "sup-new"
          )
        ),
      update: async (id, patch) => {
        const existing = suppliers.find((s) => s.id === id);
        if (!existing) {
          throw new Error("not found in fake");
        }
        return ok(
          Supplier.create(
            {
              name: patch.name ?? existing.name,
              phone: existing.phone,
              address: existing.address,
              paymentTermsDays: existing.paymentTermsDays,
            },
            existing.id
          )
        );
      },
      remove: async () => ok(undefined),
    };
    return {
      createUseCase: new CreateSupplierUseCase(repo),
      updateUseCase: new UpdateSupplierUseCase(repo),
      deleteUseCase: new DeleteSupplierUseCase(repo),
    };
  }

  it("membuat supplier", async () => {
    const result = await setup([]).createUseCase.execute({ name: "PT Baru" });
    expect(result.success).toBe(true);
  });

  it("menolak nama kosong", async () => {
    const result = await setup([]).createUseCase.execute({ name: "" });
    expect(result.success).toBe(false);
  });

  it("update supplier tak ada -> NotFound", async () => {
    const result = await setup([]).updateUseCase.execute("x", { name: "Y" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(SupplierNotFoundError);
    }
  });

  it("hapus supplier ada", async () => {
    const result = await setup([makeSupplier()]).deleteUseCase.execute("sup-1");
    expect(result.success).toBe(true);
  });
});

describe("PO workflow", () => {
  function setup(po: PurchaseOrder | null) {
    const repo: IPurchaseOrderRepository = {
      create: async () => ok({ poId: "po-new", poNo: "PO-2" }),
      findById: async (id) => ok(id === "po-1" ? po : null),
      list: async () => ok({ items: [], total: 0, page: 1, pageSize: 20 }),
      updateDraft: async () => ok(makePO()),
      setStatus: async (id, status) =>
        ok(makePO(status === "sent" ? "sent" : "cancelled")),
      receiveGoods: async () =>
        ok({ id: "gr-1", grNo: "GR-1", receivedAt: new Date() }),
      listReceipts: async () => ok([]),
      createReturn: async () =>
        ok({
          id: "r-1",
          returnNo: "PRTN-1",
          reason: "",
          totalRefund: Money.create(0),
          createdAt: new Date(),
        }),
      listReturns: async () => ok([]),
    };
    return {
      createUseCase: new CreatePOUseCase(repo),
      sendUseCase: new SendPOUseCase(repo),
      cancelUseCase: new CancelPOUseCase(repo),
      receiveUseCase: new ReceiveGoodsUseCase(repo),
      returnUseCase: new CreatePurchaseReturnUseCase(repo),
    };
  }

  it("membuat PO dengan item", async () => {
    const { createUseCase } = setup(null);
    const result = await createUseCase.execute({
      supplierId: "10000000-0000-4000-8000-000000000001",
      items: [
        {
          variantId: "e0000000-0000-4000-8000-000000000005",
          qty: 10,
          costPrice: 2900,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("menolak PO tanpa item", async () => {
    const { createUseCase } = setup(null);
    const result = await createUseCase.execute({
      supplierId: "sup-1",
      items: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it("kirim draft -> sent", async () => {
    const { sendUseCase } = setup(makePO("draft"));
    const result = await sendUseCase.execute("po-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("sent");
    }
  });

  it("kirim non-draft ditolak", async () => {
    const { sendUseCase } = setup(makePO("sent"));
    const result = await sendUseCase.execute("po-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvalidPOStatusError);
    }
  });

  it("batalkan completed ditolak", async () => {
    const { cancelUseCase } = setup(makePO("completed"));
    const result = await cancelUseCase.execute("po-1");
    expect(result.success).toBe(false);
  });

  it("PO tak ada -> NotFound", async () => {
    const { sendUseCase } = setup(null);
    const result = await sendUseCase.execute("po-x");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(PurchaseOrderNotFoundError);
    }
  });

  it("terima barang butuh item", async () => {
    const { receiveUseCase } = setup(makePO("sent"));
    const result = await receiveUseCase.execute("po-1", { items: [] });
    expect(result.success).toBe(false);
  });

  it("retur butuh alasan", async () => {
    const { returnUseCase } = setup(null);
    const result = await returnUseCase.execute("sup-1", {
      reason: "",
      items: [{ variantId: "v-1", qty: 1, costPrice: 100 }],
    });
    expect(result.success).toBe(false);
  });
});

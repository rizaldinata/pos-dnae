import { describe, expect, it } from "vitest";
import {
  CreatePromotionUseCase,
  CreateVoucherUseCase,
  ListPromotionsUseCase,
  TogglePromotionUseCase,
  ToggleVoucherUseCase,
  UpdatePromotionUseCase,
  ValidateVoucherUseCase,
} from "@/modules/promotions/application/use-cases/promotion.use-cases";
import type {
  CreatePromotionRecord,
  CreateVoucherRecord,
  IPromotionRepository,
  IVoucherRepository,
} from "@/modules/promotions/domain/repositories/promotion.repository";
import {
  Promotion,
  Voucher,
} from "@/modules/promotions/domain/entities/promotion";
import { Money } from "@/shared/lib/money";
import { NotFoundError, ValidationError } from "@/shared/kernel/errors";
import { ok, type Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

const ID = "10000000-0000-4000-8000-000000000099";

function makePromotion(id = ID): Promotion {
  return Promotion.create(
    {
      name: "Promo Lama",
      type: "percent",
      scope: "all",
      scopeRefId: null,
      value: Money.create(10),
      buyQty: 0,
      getQty: 0,
      minPurchase: Money.create(0),
      startAt: new Date("2026-10-01T00:00:00Z"),
      endAt: new Date("2026-10-31T00:00:00Z"),
      isActive: true,
    },
    id
  );
}

function makeVoucher(code = "HEMAT", id = ID): Voucher {
  return Voucher.create(
    {
      code,
      type: "amount",
      value: Money.create(5000),
      quota: 10,
      usedCount: 0,
      minPurchase: Money.create(0),
      expiresAt: null,
      isActive: true,
    },
    id
  );
}

interface PromotionSpy {
  repository: IPromotionRepository;
  created: CreatePromotionRecord[];
  updated: Array<{ id: string; patch: object }>;
}

function promotionRepo(
  existing: Promotion | null = makePromotion()
): PromotionSpy {
  const created: CreatePromotionRecord[] = [];
  const updated: Array<{ id: string; patch: object }> = [];
  const repository: IPromotionRepository = {
    findById: async () => ok(existing),
    findActive: async () => ok(existing ? [existing] : []),
    findAll: async () => ok(existing ? [existing] : []),
    create: async (record) => {
      created.push(record);
      return ok(makePromotion());
    },
    update: async (id, patch) => {
      updated.push({ id, patch });
      return ok(makePromotion(id));
    },
    toggleActive: async (id, isActive) => {
      updated.push({ id, patch: { isActive } });
      const promo = makePromotion(id);
      return ok(promo);
    },
  };
  return { repository, created, updated };
}

interface VoucherSpy {
  repository: IVoucherRepository;
  created: CreateVoucherRecord[];
}

function voucherRepo(existing: Voucher | null = makeVoucher()): VoucherSpy {
  const created: CreateVoucherRecord[] = [];
  const repository: IVoucherRepository = {
    findById: async () => ok(existing),
    findByCode: async () => ok(existing),
    findAll: async () => ok(existing ? [existing] : []),
    create: async (record) => {
      created.push(record);
      return ok(makeVoucher(record.code));
    },
    update: async () => ok(makeVoucher()),
  };
  return { repository, created };
}

const validPromotion = {
  name: "Akhir Pekan",
  type: "percent" as const,
  scope: "all" as const,
  scopeRefId: null,
  value: 15,
  buyQty: 0,
  getQty: 0,
  minPurchase: 0,
  startAt: "2026-10-01",
  endAt: "2026-10-31",
};

describe("CreatePromotionUseCase", () => {
  it("membuat promo valid dan meneruskan data ternormalisasi", async () => {
    const spy = promotionRepo(null);
    const useCase = new CreatePromotionUseCase(spy.repository);

    const result = await useCase.execute({
      ...validPromotion,
      minPurchase: 50000.7,
    });

    expect(result.success).toBe(true);
    expect(spy.created).toHaveLength(1);
    expect(spy.created[0]).toMatchObject({
      name: "Akhir Pekan",
      type: "percent",
      value: 15,
      minPurchase: 50001,
      startAt: "2026-10-01",
      endAt: "2026-10-31",
    });
  });

  it("menolak diskon persen di luar rentang 1-100", async () => {
    const spy = promotionRepo(null);
    const useCase = new CreatePromotionUseCase(spy.repository);

    const result = await useCase.execute({ ...validPromotion, value: 150 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
    expect(spy.created).toHaveLength(0);
  });

  it("menolak scope kategori tanpa memilih referensi", async () => {
    const spy = promotionRepo(null);
    const useCase = new CreatePromotionUseCase(spy.repository);

    const result = await useCase.execute({
      ...validPromotion,
      scope: "category",
      scopeRefId: null,
    });

    expect(result.success).toBe(false);
  });

  it("menolak BOGO tanpa qty beli/gratis", async () => {
    const spy = promotionRepo(null);
    const useCase = new CreatePromotionUseCase(spy.repository);

    const result = await useCase.execute({
      ...validPromotion,
      type: "bogo",
      buyQty: 0,
      getQty: 0,
    });

    expect(result.success).toBe(false);
  });

  it("menolak periode yang terbalik", async () => {
    const spy = promotionRepo(null);
    const useCase = new CreatePromotionUseCase(spy.repository);

    const result = await useCase.execute({
      ...validPromotion,
      startAt: "2026-11-01",
      endAt: "2026-10-01",
    });

    expect(result.success).toBe(false);
  });

  it("menolak nama kosong dengan pesan field", async () => {
    const spy = promotionRepo(null);
    const useCase = new CreatePromotionUseCase(spy.repository);

    const result = await useCase.execute({ ...validPromotion, name: "  " });

    expect(result.success).toBe(false);
    if (!result.success && result.error instanceof ValidationError) {
      expect(Object.keys(result.error.validationErrors ?? {})).toContain(
        "name"
      );
    }
  });
});

describe("UpdatePromotionUseCase & TogglePromotionUseCase", () => {
  it("menolak promo yang tidak ada", async () => {
    const spy = promotionRepo(null);
    const useCase = new UpdatePromotionUseCase(spy.repository);

    const result = await useCase.execute(ID, { name: "Baru" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it("menolak periode edit yang terbalik", async () => {
    const spy = promotionRepo();
    const useCase = new UpdatePromotionUseCase(spy.repository);

    const result = await useCase.execute(ID, {
      startAt: "2026-12-01",
      endAt: "2026-11-01",
    });

    expect(result.success).toBe(false);
    expect(spy.updated).toHaveLength(0);
  });

  it("meneruskan patch update yang valid", async () => {
    const spy = promotionRepo();
    const useCase = new UpdatePromotionUseCase(spy.repository);

    const result = await useCase.execute(ID, { name: "Promo Baru", value: 20 });

    expect(result.success).toBe(true);
    expect(spy.updated[0]?.id).toBe(ID);
    expect(spy.updated[0]?.patch).toMatchObject({ name: "Promo Baru" });
  });

  it("toggle menolak promo yang tidak ada", async () => {
    const spy = promotionRepo(null);
    const useCase = new TogglePromotionUseCase(spy.repository);

    const result = await useCase.execute(ID, false);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it("toggle meneruskan status aktif", async () => {
    const spy = promotionRepo();
    const useCase = new TogglePromotionUseCase(spy.repository);

    const result = await useCase.execute(ID, false);

    expect(result.success).toBe(true);
    expect(spy.updated[0]?.patch).toMatchObject({ isActive: false });
  });
});

describe("ListPromotionsUseCase", () => {
  it("mengembalikan daftar promo", async () => {
    const spy = promotionRepo();
    const useCase = new ListPromotionsUseCase(spy.repository);

    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("Promo Lama");
    }
  });
});

describe("CreateVoucherUseCase", () => {
  const validVoucher = {
    code: "hemat10",
    type: "percent" as const,
    value: 10,
    quota: 5,
    minPurchase: 0,
  };

  it("membuat voucher dan menormalkan kode menjadi huruf besar", async () => {
    const empty = voucherRepo(null);
    const useCase = new CreateVoucherUseCase(empty.repository);

    const result = await useCase.execute(validVoucher);

    expect(result.success).toBe(true);
    expect(empty.created[0]?.code).toBe("hemat10");
    if (result.success) {
      expect(result.data.code).toBe("HEMAT10");
    }
  });

  it("menolak kode yang sudah dipakai", async () => {
    const spy = voucherRepo(makeVoucher("HEMAT10"));
    const useCase = new CreateVoucherUseCase(spy.repository);

    const result = await useCase.execute(validVoucher);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
    expect(spy.created).toHaveLength(0);
  });

  it("menolak voucher persen di luar 1-100", async () => {
    const spy = voucherRepo(null);
    const useCase = new CreateVoucherUseCase(spy.repository);

    const result = await useCase.execute({ ...validVoucher, value: 0 });

    expect(result.success).toBe(false);
  });

  it("menolak kode dengan karakter terlarang", async () => {
    const spy = voucherRepo(null);
    const useCase = new CreateVoucherUseCase(spy.repository);

    const result = await useCase.execute({ ...validVoucher, code: "a b!" });

    expect(result.success).toBe(false);
  });
});

describe("ValidateVoucherUseCase", () => {
  it("menolak kode yang tidak dikenal", async () => {
    const repository: IVoucherRepository = {
      ...voucherRepo(null).repository,
      findByCode: async (): Promise<Result<Voucher | null, DomainError>> =>
        ok(null),
    };
    const useCase = new ValidateVoucherUseCase(repository);

    const result = await useCase.execute("TIDAKADA", 100000);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("Kode voucher tidak dikenal");
    }
  });

  it("mengembalikan potongan untuk voucher nominal yang valid", async () => {
    const repository = voucherRepo(makeVoucher("HEMAT")).repository;
    const useCase = new ValidateVoucherUseCase(repository);

    const result = await useCase.execute("hemat", 100000);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        voucherId: ID,
        code: "HEMAT",
        discount: 5000,
      });
    }
  });

  it("menolak voucher jika belanja di bawah minimum", async () => {
    const repository = voucherRepo(
      Voucher.create(
        {
          code: "MIN70",
          type: "amount",
          value: Money.create(5000),
          quota: 5,
          usedCount: 0,
          minPurchase: Money.create(50000),
          expiresAt: null,
          isActive: true,
        },
        ID
      )
    ).repository;
    const useCase = new ValidateVoucherUseCase(repository);

    const result = await useCase.execute("MIN70", 20000);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe(
        "Belanja belum mencapai minimum voucher"
      );
    }
  });
});

describe("ToggleVoucherUseCase", () => {
  it("menolak voucher yang tidak ada", async () => {
    const repository = voucherRepo(null).repository;
    const useCase = new ToggleVoucherUseCase(repository);

    const result = await useCase.execute(ID, false);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });

  it("menonaktifkan voucher yang ada", async () => {
    const repository = voucherRepo(makeVoucher()).repository;
    const useCase = new ToggleVoucherUseCase(repository);

    const result = await useCase.execute(ID, false);

    expect(result.success).toBe(true);
  });
});

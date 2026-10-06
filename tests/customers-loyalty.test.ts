import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOYALTY_SETTINGS,
  LOYALTY_SETTING_KEYS,
  LoyaltyPolicy,
  parseLoyaltySettings,
  redeemFailureMessage,
} from "@/modules/customers/domain/services/loyalty-policy";
import { LoyaltyTransaction } from "@/modules/customers/domain/entities/loyalty";
import { Customer } from "@/modules/customers/domain/entities/customer";
import type { ICustomerRepository } from "@/modules/customers/domain/repositories/customer.repository";
import type {
  AdjustLoyaltyRecord,
  ILoyaltyRepository,
} from "@/modules/customers/domain/repositories/loyalty.repository";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import {
  AdjustPointsUseCase,
  EarnPointsUseCase,
  GetLoyaltyHistoryUseCase,
  RedeemPointsUseCase,
} from "@/modules/customers/application/use-cases/loyalty.use-cases";
import {
  GetLoyaltySettingsUseCase,
  UpdateLoyaltySettingsUseCase,
} from "@/modules/settings/application/use-cases/loyalty-settings.use-cases";
import {
  InvariantViolationError,
  NotFoundError,
  ValidationError,
} from "@/shared/kernel/errors";
import { err, ok } from "@/shared/kernel/result";

const CUSTOMER_ID = "10000000-0000-4000-8000-000000000001";

const DEFAULTS = {
  earnRatio: DEFAULT_LOYALTY_SETTINGS.earnRatio,
  pointValue: DEFAULT_LOYALTY_SETTINGS.pointValue,
};

function makeCustomer(points: number, id = CUSTOMER_ID): Customer {
  return Customer.create(
    {
      name: "Budi",
      phone: "",
      email: "",
      address: "",
      points,
      receivableBalance: 0,
    },
    id
  );
}

function customersRepo(options?: {
  points?: number;
  exists?: boolean;
}): ICustomerRepository {
  const exists = options?.exists ?? true;
  const points = options?.points ?? 0;
  return {
    findById: async (id) =>
      ok(id === CUSTOMER_ID && exists ? makeCustomer(points) : null),
    search: async () => ok({ items: [], total: 0, page: 1, pageSize: 20 }),
    create: async () => {
      throw new InvariantViolationError("not used");
    },
    update: async () => {
      throw new InvariantViolationError("not used");
    },
    softDelete: async () => ok(undefined),
    getHistory: async () =>
      ok({
        purchases: [],
        totalSpent: 0,
        transactionCount: 0,
        averagePerTransaction: 0,
      }),
  };
}

function settingsRepo(record: Record<string, unknown> | null = null): {
  repository: ISettingsRepository;
  saved: () => Record<string, unknown> | null;
} {
  let saved: Record<string, unknown> | null = null;
  const repository: ISettingsRepository = {
    getAll: async () =>
      record === null
        ? err(new InvariantViolationError("Database error: down"))
        : ok(record),
    get: async (key) => ok(record?.[key] ?? null),
    set: async (key, value) => {
      if (record) {
        record[key] = value;
      }
      return ok(undefined);
    },
    setMany: async (entries) => {
      saved = entries;
      if (record) {
        Object.assign(record, entries);
      }
      return ok(undefined);
    },
  };
  return { repository, saved: () => saved };
}

function loyaltyRepo(items: LoyaltyTransaction[] = []): {
  repository: ILoyaltyRepository;
  adjusted: AdjustLoyaltyRecord[];
} {
  const adjusted: AdjustLoyaltyRecord[] = [];
  const repository: ILoyaltyRepository = {
    listByCustomer: async () => ok(items),
    adjust: async (record) => {
      adjusted.push(record);
      return ok(
        LoyaltyTransaction.create(
          {
            customerId: record.customerId,
            saleId: null,
            points: record.points,
            type: "adjust",
            note: record.note,
          },
          "txn-adjust"
        )
      );
    },
  };
  return { repository, adjusted };
}

describe("LoyaltyPolicy", () => {
  const settings = { earnRatio: 10000, pointValue: 100 };

  it("menghitung poin perolehan dengan pembulatan ke bawah", () => {
    expect(LoyaltyPolicy.pointsForAmount(25000, settings)).toBe(2);
    expect(LoyaltyPolicy.pointsForAmount(10000, settings)).toBe(1);
    expect(LoyaltyPolicy.pointsForAmount(9999, settings)).toBe(0);
  });

  it("menonaktifkan perolehan bila rasio 0 atau nominal tidak sah", () => {
    expect(
      LoyaltyPolicy.pointsForAmount(50000, { ...settings, earnRatio: 0 })
    ).toBe(0);
    expect(LoyaltyPolicy.pointsForAmount(0, settings)).toBe(0);
    expect(LoyaltyPolicy.pointsForAmount(-1000, settings)).toBe(0);
    expect(LoyaltyPolicy.pointsForAmount(Number.NaN, settings)).toBe(0);
  });

  it("menghitung nilai rupiah dari poin", () => {
    expect(LoyaltyPolicy.valueOfPoints(150, settings)).toBe(15000);
    expect(LoyaltyPolicy.valueOfPoints(0, settings)).toBe(0);
    expect(LoyaltyPolicy.valueOfPoints(-5, settings)).toBe(0);
  });

  it("menolak penukaran bila saldo tidak cukup", () => {
    const check = LoyaltyPolicy.validateRedeem(5, 10, 100000, settings);
    expect(check).toEqual({ ok: false, reason: "insufficient_points" });
  });

  it("menolak penukaran bila jumlah poin tidak valid", () => {
    expect(LoyaltyPolicy.validateRedeem(100, 0, 100000, settings)).toEqual({
      ok: false,
      reason: "invalid_points",
    });
    expect(LoyaltyPolicy.validateRedeem(100, 1.5, 100000, settings)).toEqual({
      ok: false,
      reason: "invalid_points",
    });
  });

  it("menolak penukaran bila nilai poin melebihi sisa tagihan", () => {
    const check = LoyaltyPolicy.validateRedeem(500, 100, 5000, settings);
    expect(check).toEqual({ ok: false, reason: "exceeds_total" });
  });

  it("menolak penukaran bila nilai poin dinonaktifkan", () => {
    const check = LoyaltyPolicy.validateRedeem(500, 10, 100000, {
      ...settings,
      pointValue: 0,
    });
    expect(check).toEqual({ ok: false, reason: "loyalty_disabled" });
  });

  it("mengembalikan potongan untuk penukaran yang valid", () => {
    const check = LoyaltyPolicy.validateRedeem(500, 25, 100000, settings);
    expect(check).toEqual({ ok: true, discount: 2500 });
  });

  it("membaca record settings dengan fallback default", () => {
    expect(parseLoyaltySettings({})).toEqual(DEFAULTS);
    expect(
      parseLoyaltySettings({
        [LOYALTY_SETTING_KEYS.earnRatio]: 5000,
        [LOYALTY_SETTING_KEYS.pointValue]: "250",
      })
    ).toEqual({ earnRatio: 5000, pointValue: 250 });
    expect(
      parseLoyaltySettings({
        [LOYALTY_SETTING_KEYS.earnRatio]: -1,
        [LOYALTY_SETTING_KEYS.pointValue]: -1,
      })
    ).toEqual({ earnRatio: 0, pointValue: 0 });
  });

  it("menyediakan pesan kegagalan yang dapat ditampilkan", () => {
    expect(redeemFailureMessage("insufficient_points")).toBe(
      "Poin pelanggan tidak cukup"
    );
    expect(redeemFailureMessage("exceeds_total")).toBe(
      "Poin melebihi sisa tagihan"
    );
  });
});

describe("EarnPointsUseCase", () => {
  it("mengembalikan estimasi poin dari settings", async () => {
    const useCase = new EarnPointsUseCase(
      customersRepo({ points: 120 }),
      settingsRepo({
        [LOYALTY_SETTING_KEYS.earnRatio]: 5000,
        [LOYALTY_SETTING_KEYS.pointValue]: 100,
      }).repository
    );
    const result = await useCase.execute({
      customerId: CUSTOMER_ID,
      amount: 25000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        customerId: CUSTOMER_ID,
        currentPoints: 120,
        earnRatio: 5000,
        pointValue: 100,
        earnedPoints: 5,
      });
    }
  });

  it("memakai default saat settings tidak dapat dibaca", async () => {
    const useCase = new EarnPointsUseCase(
      customersRepo(),
      settingsRepo(null).repository
    );
    const result = await useCase.execute({
      customerId: CUSTOMER_ID,
      amount: 25000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.earnRatio).toBe(DEFAULT_LOYALTY_SETTINGS.earnRatio);
      expect(result.data.earnedPoints).toBe(2);
    }
  });

  it("menolak pelanggan yang tidak ada", async () => {
    const useCase = new EarnPointsUseCase(
      customersRepo(),
      settingsRepo({}).repository
    );
    const result = await useCase.execute({
      customerId: "missing",
      amount: 1000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});

describe("RedeemPointsUseCase", () => {
  it("menghitung potongan penukaran", async () => {
    const useCase = new RedeemPointsUseCase(
      customersRepo({ points: 500 }),
      settingsRepo({}).repository
    );
    const result = await useCase.execute({
      customerId: CUSTOMER_ID,
      points: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        customerId: CUSTOMER_ID,
        currentPoints: 500,
        points: 100,
        discount: 10000,
        pointValue: 100,
      });
    }
  });

  it("menolak bila saldo poin tidak cukup", async () => {
    const useCase = new RedeemPointsUseCase(
      customersRepo({ points: 5 }),
      settingsRepo({}).repository
    );
    const result = await useCase.execute({
      customerId: CUSTOMER_ID,
      points: 100,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toBe("Poin pelanggan tidak cukup");
    }
  });

  it("menolak tanpa pelanggan", async () => {
    const useCase = new RedeemPointsUseCase(
      customersRepo(),
      settingsRepo({}).repository
    );
    const result = await useCase.execute({ customerId: "", points: 10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe(
        "Penukaran poin wajib memilih pelanggan"
      );
    }
  });

  it("menolak jumlah poin tidak valid", async () => {
    const useCase = new RedeemPointsUseCase(
      customersRepo({ points: 100 }),
      settingsRepo({}).repository
    );
    const result = await useCase.execute({
      customerId: CUSTOMER_ID,
      points: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("Jumlah poin tidak valid");
    }
  });
});

describe("AdjustPointsUseCase", () => {
  it("meneruskan penyesuaian ke repository", async () => {
    const spy = loyaltyRepo();
    const useCase = new AdjustPointsUseCase(spy.repository, customersRepo());
    const result = await useCase.execute(CUSTOMER_ID, {
      points: 50,
      note: "Kompensasi",
    });
    expect(result.success).toBe(true);
    expect(spy.adjusted).toEqual([
      { customerId: CUSTOMER_ID, points: 50, note: "Kompensasi" },
    ]);
    if (result.success) {
      expect(result.data.type).toBe("adjust");
      expect(result.data.points).toBe(50);
    }
  });

  it("menolak tanpa alasan", async () => {
    const spy = loyaltyRepo();
    const useCase = new AdjustPointsUseCase(spy.repository, customersRepo());
    const result = await useCase.execute(CUSTOMER_ID, {
      points: 50,
      note: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success && result.error instanceof ValidationError) {
      expect(Object.keys(result.error.validationErrors ?? {})).toContain(
        "note"
      );
    }
    expect(spy.adjusted).toHaveLength(0);
  });

  it("menolak poin nol", async () => {
    const spy = loyaltyRepo();
    const useCase = new AdjustPointsUseCase(spy.repository, customersRepo());
    const result = await useCase.execute(CUSTOMER_ID, {
      points: 0,
      note: "Alasan",
    });
    expect(result.success).toBe(false);
    expect(spy.adjusted).toHaveLength(0);
  });

  it("menolak pelanggan yang tidak ada", async () => {
    const spy = loyaltyRepo();
    const useCase = new AdjustPointsUseCase(spy.repository, customersRepo());
    const result = await useCase.execute("missing", {
      points: 10,
      note: "Alasan",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
  });
});

describe("GetLoyaltyHistoryUseCase", () => {
  it("mengembalikan riwayat poin pelanggan", async () => {
    const item = LoyaltyTransaction.create(
      {
        customerId: CUSTOMER_ID,
        saleId: "sale-1",
        points: 3,
        type: "earn",
        note: null,
      },
      "txn-1"
    );
    const useCase = new GetLoyaltyHistoryUseCase(
      loyaltyRepo([item]).repository
    );
    const result = await useCase.execute(CUSTOMER_ID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.points).toBe(3);
    }
  });

  it("menolak tanpa pelanggan", async () => {
    const useCase = new GetLoyaltyHistoryUseCase(loyaltyRepo().repository);
    const result = await useCase.execute("");
    expect(result.success).toBe(false);
  });
});

describe("Get/UpdateLoyaltySettingsUseCase", () => {
  it("mengembalikan settings dengan default bila kunci belum ada", async () => {
    const useCase = new GetLoyaltySettingsUseCase(settingsRepo({}).repository);
    const result = await useCase.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(DEFAULTS);
    }
  });

  it("menyimpan rasio ke kunci settings yang sesuai", async () => {
    const spy = settingsRepo({});
    const useCase = new UpdateLoyaltySettingsUseCase(spy.repository);
    const result = await useCase.execute({ earnRatio: 20000, pointValue: 250 });
    expect(result.success).toBe(true);
    expect(spy.saved()).toEqual({
      [LOYALTY_SETTING_KEYS.earnRatio]: 20000,
      [LOYALTY_SETTING_KEYS.pointValue]: 250,
    });
  });

  it("menolak nilai negatif", async () => {
    const spy = settingsRepo({});
    const useCase = new UpdateLoyaltySettingsUseCase(spy.repository);
    const result = await useCase.execute({ earnRatio: -1, pointValue: 100 });
    expect(result.success).toBe(false);
    if (!result.success && result.error instanceof ValidationError) {
      expect(Object.keys(result.error.validationErrors ?? {})).toContain(
        "earnRatio"
      );
    }
    expect(spy.saved()).toBeNull();
  });
});

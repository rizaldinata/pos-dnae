import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPIRY_WARNING_DAYS,
  EXPIRY_SETTING_KEYS,
  addDaysIso,
  classifyExpiry,
  parseExpiryWarningDays,
} from "@/modules/inventory/domain/services/expiry-policy";
import {
  GetExpiringBatchesUseCase,
  GetExpiringCountUseCase,
} from "@/modules/inventory/application/use-cases/expiry.use-cases";
import {
  GetInventorySettingsUseCase,
  UpdateInventorySettingsUseCase,
} from "@/modules/settings/application/use-cases/inventory-settings.use-cases";
import type {
  IStockRepository,
  ExpiringBatchFilter,
} from "@/modules/inventory/domain/repositories/stock.repository";
import type { ISettingsRepository } from "@/modules/settings/domain/repositories/settings.repository";
import {
  InvariantViolationError,
  ValidationError,
} from "@/shared/kernel/errors";
import { err, ok } from "@/shared/kernel/result";

const KEY = EXPIRY_SETTING_KEYS.expiryWarningDays;

function settingsRepo(record: Record<string, unknown> | null = {}): {
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
    set: async () => ok(undefined),
    setMany: async (entries) => {
      saved = entries;
      return ok(undefined);
    },
  };
  return { repository, saved: () => saved };
}

function stockRepo(options?: {
  count?: number;
  capturedFilter?: ExpiringBatchFilter;
  list?: {
    items: {
      id: string;
      variantId: string;
      productName: string;
      variantName: string;
      sku: string;
      batchNo: string;
      qty: number;
      expiryDate: string;
      status: "expired" | "expiring";
    }[];
    total: number;
    page: number;
    pageSize: number;
  };
}): {
  repository: IStockRepository;
  captured: () => ExpiringBatchFilter | null;
  capturedWarningDays: () => number | null;
} {
  let captured: ExpiringBatchFilter | null = null;
  let capturedWarningDays: number | null = null;
  const repository: IStockRepository = {
    getByVariantId: async () => ok(null),
    listOverview: async () =>
      ok({ items: [], total: 0, page: 1, pageSize: 20 }),
    getOverviewByVariantId: async () => ok(null),
    adjustStock: async () => {
      throw new InvariantViolationError("not used");
    },
    countLowStock: async () => ok(0),
    countExpiringBatches: async (warningDays) => {
      capturedWarningDays = warningDays;
      return ok(options?.count ?? 0);
    },
    listExpiringBatches: async (filter) => {
      captured = filter;
      return ok(
        options?.list ?? { items: [], total: 0, page: 1, pageSize: 20 }
      );
    },
    listBatchesByVariant: async () => ok([]),
  };
  return {
    repository,
    captured: () => captured,
    capturedWarningDays: () => capturedWarningDays,
  };
}

describe("parseExpiryWarningDays", () => {
  it("memakai default bila key tidak ada", () => {
    expect(parseExpiryWarningDays({})).toBe(DEFAULT_EXPIRY_WARNING_DAYS);
  });

  it("membaca nilai number", () => {
    expect(parseExpiryWarningDays({ [KEY]: 45 })).toBe(45);
  });

  it("membaca nilai string angka", () => {
    expect(parseExpiryWarningDays({ [KEY]: "60" })).toBe(60);
  });

  it("membuang pecahan ke bawah", () => {
    expect(parseExpiryWarningDays({ [KEY]: 12.7 })).toBe(12);
  });

  it("menolak nilai di luar 1..365 dan bukan angka", () => {
    expect(parseExpiryWarningDays({ [KEY]: 0 })).toBe(
      DEFAULT_EXPIRY_WARNING_DAYS
    );
    expect(parseExpiryWarningDays({ [KEY]: 400 })).toBe(
      DEFAULT_EXPIRY_WARNING_DAYS
    );
    expect(parseExpiryWarningDays({ [KEY]: "abc" })).toBe(
      DEFAULT_EXPIRY_WARNING_DAYS
    );
    expect(parseExpiryWarningDays({ [KEY]: null })).toBe(
      DEFAULT_EXPIRY_WARNING_DAYS
    );
  });
});

describe("classifyExpiry", () => {
  const today = "2026-10-06";

  it("tanpa tanggal dianggap ok", () => {
    expect(classifyExpiry(null, 30, today)).toBe("ok");
    expect(classifyExpiry(undefined, 30, today)).toBe("ok");
  });

  it("tanggal lewat hari ini dianggap expired", () => {
    expect(classifyExpiry("2026-10-05", 30, today)).toBe("expired");
  });

  it("hari ini dan batas peringatan dianggap expiring", () => {
    expect(classifyExpiry(today, 30, today)).toBe("expiring");
    expect(classifyExpiry("2026-11-05", 30, today)).toBe("expiring");
  });

  it("lewat batas peringatan dianggap ok", () => {
    expect(classifyExpiry("2026-11-06", 30, today)).toBe("ok");
    expect(classifyExpiry("2027-01-01", 30, today)).toBe("ok");
  });
});

describe("addDaysIso", () => {
  it("menambah hari dalam format YYYY-MM-DD", () => {
    expect(addDaysIso("2026-10-06", 30)).toBe("2026-11-05");
    expect(addDaysIso("2026-10-06", 0)).toBe("2026-10-06");
  });

  it("melewati batas bulan dan tahun", () => {
    expect(addDaysIso("2026-12-25", 10)).toBe("2027-01-04");
    expect(addDaysIso("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("GetInventorySettingsUseCase", () => {
  it("mengembalikan hari peringatan tersimpan", async () => {
    const { repository } = settingsRepo({ [KEY]: 14 });
    const result = await new GetInventorySettingsUseCase(repository).execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiryWarningDays).toBe(14);
    }
  });

  it("mengembalikan default bila belum diset", async () => {
    const { repository } = settingsRepo({});
    const result = await new GetInventorySettingsUseCase(repository).execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiryWarningDays).toBe(DEFAULT_EXPIRY_WARNING_DAYS);
    }
  });

  it("meneruskan error repository", async () => {
    const { repository } = settingsRepo(null);
    const result = await new GetInventorySettingsUseCase(repository).execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvariantViolationError);
    }
  });
});

describe("UpdateInventorySettingsUseCase", () => {
  it("menyimpan hari peringatan ke settings", async () => {
    const { repository, saved } = settingsRepo({});
    const result = await new UpdateInventorySettingsUseCase(repository).execute(
      { expiryWarningDays: 10 }
    );

    expect(result.success).toBe(true);
    expect(saved()).toEqual({ [KEY]: 10 });
  });

  it("menolak nilai di luar rentang", async () => {
    const { repository } = settingsRepo({});
    const useCase = new UpdateInventorySettingsUseCase(repository);

    const tooSmall = await useCase.execute({ expiryWarningDays: 0 });
    expect(tooSmall.success).toBe(false);
    if (!tooSmall.success) {
      expect(tooSmall.error).toBeInstanceOf(ValidationError);
    }

    const tooLarge = await useCase.execute({ expiryWarningDays: 400 });
    expect(tooLarge.success).toBe(false);
  });
});

describe("GetExpiringCountUseCase", () => {
  it("memakai hari peringatan dari settings saat menghitung", async () => {
    const settings = settingsRepo({ [KEY]: 45 });
    const stocks = stockRepo({ count: 7 });
    const useCase = new GetExpiringCountUseCase(
      stocks.repository,
      settings.repository
    );

    const result = await useCase.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(7);
    }
    expect(stocks.capturedWarningDays()).toBe(45);
  });

  it("memakai default saat settings belum diset", async () => {
    const settings = settingsRepo({});
    const stocks = stockRepo();
    const useCase = new GetExpiringCountUseCase(
      stocks.repository,
      settings.repository
    );

    await useCase.execute();
    expect(stocks.capturedWarningDays()).toBe(DEFAULT_EXPIRY_WARNING_DAYS);
  });
});

describe("GetExpiringBatchesUseCase", () => {
  it("meneruskan filter dengan hari peringatan dari settings", async () => {
    const settings = settingsRepo({ [KEY]: 15 });
    const stocks = stockRepo();
    const useCase = new GetExpiringBatchesUseCase(
      stocks.repository,
      settings.repository
    );

    const result = await useCase.execute({ status: "expired", page: 2 });
    expect(result.success).toBe(true);
    expect(stocks.captured()).toEqual({
      warningDays: 15,
      status: "expired",
      page: 2,
      pageSize: undefined,
    });
  });

  it("meneruskan error repository", async () => {
    const settings = settingsRepo({});
    const failing: IStockRepository = {
      ...stockRepo().repository,
      listExpiringBatches: async () =>
        err(new InvariantViolationError("Database error: down")),
    };
    const useCase = new GetExpiringBatchesUseCase(failing, settings.repository);
    const result = await useCase.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvariantViolationError);
    }
  });
});

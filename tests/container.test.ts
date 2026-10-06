import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createContainer } from "@/di/container";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";

describe("Dependency Injection Container", () => {
  it("initializes container and wires sales use cases", async () => {
    // Mock Supabase clients for container instantiation
    const mockSupabase = {} as SupabaseClient<Database>;
    const mockAdminSupabase = {} as SupabaseClient<Database>;

    const container = createContainer(mockSupabase, mockAdminSupabase);

    expect(container).toBeDefined();
    expect(container.sales).toBeDefined();
    expect(container.sales.checkout).toBeDefined();
    expect(container.sales.getSaleReceipt).toBeDefined();
    expect(container.sales.searchProductsForPOS).toBeDefined();
    expect(container.iam).toBeDefined();
    expect(container.iam.login).toBeDefined();
    expect(container.catalog).toBeDefined();
    expect(container.catalog.createProduct).toBeDefined();
    expect(container.catalog.getBundleItems).toBeDefined();
    expect(container.catalog.saveBundleItems).toBeDefined();
    expect(container.catalog.previewProductImport).toBeDefined();
    expect(container.catalog.importProducts).toBeDefined();
    expect(container.inventory).toBeDefined();
    expect(container.inventory.getStockCard).toBeDefined();
    expect(container.inventory.getExpiringCount).toBeDefined();
    expect(container.inventory.getExpiringBatches).toBeDefined();
    expect(container.settings).toBeDefined();
    expect(container.settings.listActivePaymentMethods).toBeDefined();
    expect(container.settings.getInventorySettings).toBeDefined();
    expect(container.settings.updateInventorySettings).toBeDefined();
    expect(container.reporting).toBeDefined();
    expect(container.reporting.getSalesReport).toBeDefined();
    expect(container.shifts).toBeDefined();
    expect(container.shifts.openShift).toBeDefined();
    expect(container.shifts.closeShift).toBeDefined();
    expect(container.customers).toBeDefined();
    expect(container.customers.createCustomer).toBeDefined();
    expect(container.customers.getCustomerHistory).toBeDefined();
    expect(container.reporting.getOperationalReport).toBeDefined();
    expect(container.reporting.getProductProfit).toBeDefined();
    expect(container.reporting.getPeriodProfit).toBeDefined();
    expect(container.settings.listAuditLogs).toBeDefined();
    expect(container.purchasing.createSupplier).toBeDefined();
    expect(container.purchasing.listSupplierDebts).toBeDefined();
    expect(container.customers.listReceivables).toBeDefined();
    expect(container.purchasing.createPO).toBeDefined();
    expect(container.purchasing.receiveGoods).toBeDefined();
    expect(container.finance).toBeDefined();
    expect(container.finance.recordExpense).toBeDefined();
    expect(container.finance.getProfitLoss).toBeDefined();
  });
});

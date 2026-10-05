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
    expect(container.inventory).toBeDefined();
    expect(container.inventory.getStockCard).toBeDefined();
    expect(container.settings).toBeDefined();
    expect(container.settings.listActivePaymentMethods).toBeDefined();
    expect(container.reporting).toBeDefined();
    expect(container.reporting.getSalesReport).toBeDefined();
  });
});

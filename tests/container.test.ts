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
    expect(container.iam).toBeDefined();
    expect(container.iam.login).toBeDefined();

    const checkoutResult = await container.sales.checkout.execute({
      totalAmount: 150000,
    });

    expect(checkoutResult.success).toBe(true);
    if (checkoutResult.success) {
      expect(checkoutResult.data.totalAmount).toBe(150000);
      expect(checkoutResult.data.invoiceNumber).toMatch(/^INV-/);
    }
  });
});

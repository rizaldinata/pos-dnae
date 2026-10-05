import { describe, expect, it } from "vitest";
import { createContainer } from "@/di/container";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";

describe("Dependency Injection Container", () => {
  it("initializes container and wires sales use cases", async () => {
    // Mock Supabase client for container instantiation
    const mockSupabase = {} as SupabaseClient<Database>;

    const container = createContainer(mockSupabase);

    expect(container).toBeDefined();
    expect(container.sales).toBeDefined();
    expect(container.sales.checkout).toBeDefined();

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

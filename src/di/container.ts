import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server-client";

// Sales module dependencies
import { SupabaseSaleRepository } from "@/modules/sales/infrastructure/supabase-sale.repository";
import { CheckoutUseCase } from "@/modules/sales/application/use-cases/checkout.use-case";

export interface AppContainer {
  sales: {
    checkout: CheckoutUseCase;
  };
}

/**
 * Creates the composition root container wiring repositories with use cases.
 */
export function createContainer(
  supabase: SupabaseClient<Database>
): AppContainer {
  // 1. Repositories
  const saleRepository = new SupabaseSaleRepository(supabase);

  // 2. Use Cases
  const checkoutUseCase = new CheckoutUseCase(saleRepository);

  return {
    sales: {
      checkout: checkoutUseCase,
    },
  };
}

/**
 * Convenience helper to instantiate container in Server Actions / Server Components
 */
export async function getAppContainer(): Promise<AppContainer> {
  const supabase = await createSupabaseServerClient();
  return createContainer(supabase);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server-client";
import { createSupabaseAdminClient } from "@/shared/infrastructure/supabase/admin-client";

// Sales module dependencies
import { SupabaseSaleRepository } from "@/modules/sales/infrastructure/supabase-sale.repository";
import { CheckoutUseCase } from "@/modules/sales/application/use-cases/checkout.use-case";

// IAM module dependencies
import { SupabaseUserRepository } from "@/modules/iam/infrastructure/supabase-user.repository";
import { SupabaseRoleRepository } from "@/modules/iam/infrastructure/supabase-role.repository";
import { SupabaseAuthService } from "@/modules/iam/infrastructure/supabase-auth.service";
import { LoginUseCase } from "@/modules/iam/application/use-cases/login.use-case";
import { GetCurrentUserUseCase } from "@/modules/iam/application/use-cases/get-current-user.use-case";
import { ListUsersUseCase } from "@/modules/iam/application/use-cases/list-users.use-case";
import { ListRolesUseCase } from "@/modules/iam/application/use-cases/list-roles.use-case";
import { CreateUserUseCase } from "@/modules/iam/application/use-cases/create-user.use-case";
import { UpdateUserUseCase } from "@/modules/iam/application/use-cases/update-user.use-case";

export interface AppContainer {
  sales: {
    checkout: CheckoutUseCase;
  };
  iam: {
    login: LoginUseCase;
    getCurrentUser: GetCurrentUserUseCase;
    listUsers: ListUsersUseCase;
    listRoles: ListRolesUseCase;
    createUser: CreateUserUseCase;
    updateUser: UpdateUserUseCase;
  };
}

/**
 * Creates the composition root container wiring repositories with use cases.
 */
export function createContainer(
  supabase: SupabaseClient<Database>,
  adminSupabase: SupabaseClient<Database>
): AppContainer {
  // 1. Repositories & services
  const saleRepository = new SupabaseSaleRepository(supabase);
  const userRepository = new SupabaseUserRepository(supabase, adminSupabase);
  const roleRepository = new SupabaseRoleRepository(supabase);
  const authService = new SupabaseAuthService(supabase);

  // 2. Use Cases
  const checkoutUseCase = new CheckoutUseCase(saleRepository);

  return {
    sales: {
      checkout: checkoutUseCase,
    },
    iam: {
      login: new LoginUseCase(userRepository, authService),
      getCurrentUser: new GetCurrentUserUseCase(userRepository, authService),
      listUsers: new ListUsersUseCase(userRepository),
      listRoles: new ListRolesUseCase(roleRepository),
      createUser: new CreateUserUseCase(userRepository, roleRepository),
      updateUser: new UpdateUserUseCase(userRepository, roleRepository),
    },
  };
}

/**
 * Convenience helper to instantiate container in Server Actions / Server Components
 */
export async function getAppContainer(): Promise<AppContainer> {
  const supabase = await createSupabaseServerClient();
  const adminSupabase = createSupabaseAdminClient();
  return createContainer(supabase, adminSupabase);
}

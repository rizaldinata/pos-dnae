import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  IAuthService,
  SessionIdentity,
} from "@/modules/iam/application/ports/auth-service.port";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

export class SupabaseAuthService implements IAuthService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  public async signIn(
    email: string,
    password: string
  ): Promise<Result<SessionIdentity, DomainError>> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      return err(new InvariantViolationError(error?.message ?? "Login gagal"));
    }
    return ok({ userId: data.user.id, email: data.user.email ?? email });
  }

  public async signOut(): Promise<Result<void, DomainError>> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      return err(new InvariantViolationError(error.message));
    }
    return ok(undefined);
  }

  public async getCurrentIdentity(): Promise<
    Result<SessionIdentity | null, DomainError>
  > {
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      return ok(null);
    }
    if (!data.user) {
      return ok(null);
    }
    return ok({ userId: data.user.id, email: data.user.email ?? "" });
  }
}

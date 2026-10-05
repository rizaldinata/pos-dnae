import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";

export interface SessionIdentity {
  userId: string;
  email: string;
}

export interface IAuthService {
  signIn(
    email: string,
    password: string
  ): Promise<Result<SessionIdentity, DomainError>>;
  signOut(): Promise<Result<void, DomainError>>;
  getCurrentIdentity(): Promise<Result<SessionIdentity | null, DomainError>>;
}

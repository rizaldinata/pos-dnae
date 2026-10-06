import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/types";
import type {
  IAuthService,
  PinUserSummary,
  SessionIdentity,
} from "@/modules/iam/application/ports/auth-service.port";
import { verifyPin } from "@/modules/iam/domain/services/pin-hash";
import { err, ok, type Result } from "@/shared/kernel/result";
import {
  InvariantViolationError,
  type DomainError,
} from "@/shared/kernel/errors";

const PIN_MAX_ATTEMPTS = 3;
const PIN_LOCK_MINUTES = 15;

export class SupabaseAuthService implements IAuthService {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly adminClient: SupabaseClient<Database>
  ) {}

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

  public async signInWithPin(
    userId: string,
    pin: string
  ): Promise<Result<SessionIdentity, DomainError>> {
    const { data: profile, error: profileError } = await this.adminClient
      .from("profiles")
      .select("id,is_active,pin_hash,pin_attempts,pin_locked_until")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return err(
        new InvariantViolationError(`Database error: ${profileError.message}`)
      );
    }
    if (profile === null) {
      return err(new InvariantViolationError("Pengguna tidak ditemukan"));
    }
    const row = profile as {
      id: string;
      is_active: boolean;
      pin_hash: string | null;
      pin_attempts: number;
      pin_locked_until: string | null;
    };

    if (!row.is_active) {
      return err(new InvariantViolationError("Akun dinonaktifkan"));
    }
    if (!row.pin_hash) {
      return err(
        new InvariantViolationError("PIN belum diatur untuk pengguna ini")
      );
    }
    if (
      row.pin_locked_until &&
      new Date(row.pin_locked_until).getTime() > Date.now()
    ) {
      return err(
        new InvariantViolationError(
          "PIN terkunci sementara. Masuk dengan email + kata sandi."
        )
      );
    }

    if (!verifyPin(pin, row.pin_hash)) {
      const attempts = Number(row.pin_attempts ?? 0) + 1;
      const lockedUntil =
        attempts >= PIN_MAX_ATTEMPTS
          ? new Date(Date.now() + PIN_LOCK_MINUTES * 60000).toISOString()
          : null;
      await this.adminClient
        .from("profiles")
        .update({ pin_attempts: attempts, pin_locked_until: lockedUntil })
        .eq("id", userId);
      if (lockedUntil) {
        return err(
          new InvariantViolationError(
            "PIN salah 3 kali. Masuk dengan email + kata sandi."
          )
        );
      }
      return err(new InvariantViolationError("PIN salah"));
    }

    await this.adminClient
      .from("profiles")
      .update({ pin_attempts: 0, pin_locked_until: null })
      .eq("id", userId);

    const { data: authUser, error: authError } =
      await this.adminClient.auth.admin.getUserById(userId);
    if (authError || !authUser.user.email) {
      return err(new InvariantViolationError("Pengguna tidak ditemukan"));
    }

    // Terbitkan sesi lewat magic link admin + verifikasi (tanpa kata sandi).
    const { data: link, error: linkError } =
      await this.adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: authUser.user.email,
      });
    if (linkError || !link.properties.hashed_token) {
      return err(new InvariantViolationError("Gagal membuat sesi PIN"));
    }

    const { data: session, error: verifyError } =
      await this.client.auth.verifyOtp({
        type: "magiclink",
        token_hash: link.properties.hashed_token,
      });
    if (verifyError || !session.user || session.user.id !== userId) {
      return err(new InvariantViolationError("Gagal membuat sesi PIN"));
    }

    return ok({ userId: session.user.id, email: session.user.email ?? "" });
  }

  public async listPinUsers(): Promise<Result<PinUserSummary[], DomainError>> {
    const { data, error } = await this.adminClient
      .from("profiles")
      .select("id,full_name,roles ( name )")
      .eq("is_active", true)
      .not("pin_hash", "is", null)
      .order("full_name");
    if (error) {
      return err(
        new InvariantViolationError(`Database error: ${error.message}`)
      );
    }
    const rows = (
      (data ?? []) as unknown as {
        id: string;
        full_name: string;
        roles: { name: string } | null;
      }[]
    ).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      roleName: row.roles?.name ?? "-",
    }));
    return ok(rows);
  }
}

import { DomainError } from "@/shared/kernel/errors";

export class UserNotFoundError extends DomainError {
  public readonly code = "USER_NOT_FOUND";

  constructor(id?: string) {
    super(
      id
        ? `Pengguna dengan ID "${id}" tidak ditemukan`
        : "Pengguna tidak ditemukan"
    );
  }
}

export class UserInactiveError extends DomainError {
  public readonly code = "USER_INACTIVE";

  constructor() {
    super(
      "Akun pengguna sudah dinonaktifkan. Hubungi Owner untuk mengaktifkan kembali."
    );
  }
}

export class InvalidCredentialsError extends DomainError {
  public readonly code = "INVALID_CREDENTIALS";

  constructor() {
    super("Email atau kata sandi salah");
  }
}

export class EmailAlreadyExistsError extends DomainError {
  public readonly code = "EMAIL_ALREADY_EXISTS";

  constructor(email: string) {
    super(`Email "${email}" sudah terdaftar`);
  }
}

export class CannotDeactivateSelfError extends DomainError {
  public readonly code = "CANNOT_DEACTIVATE_SELF";

  constructor() {
    super("Anda tidak dapat menonaktifkan akun sendiri");
  }
}

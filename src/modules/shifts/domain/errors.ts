import { DomainError } from "@/shared/kernel/errors";

export class ShiftAlreadyOpenError extends DomainError {
  public readonly code = "SHIFT_ALREADY_OPEN";

  constructor() {
    super(
      "Anda masih memiliki shift yang terbuka. Tutup dulu sebelum membuka yang baru."
    );
  }
}

export class NoOpenShiftError extends DomainError {
  public readonly code = "NO_OPEN_SHIFT";

  constructor() {
    super(
      "Tidak ada shift terbuka. Buka shift terlebih dahulu sebelum transaksi."
    );
  }
}

export class ShiftAlreadyClosedError extends DomainError {
  public readonly code = "SHIFT_ALREADY_CLOSED";

  constructor() {
    super("Shift sudah ditutup");
  }
}

export class ShiftNotFoundError extends DomainError {
  public readonly code = "SHIFT_NOT_FOUND";

  constructor() {
    super("Shift tidak ditemukan");
  }
}

export class NotShiftOwnerError extends DomainError {
  public readonly code = "NOT_SHIFT_OWNER";

  constructor() {
    super("Hanya pembuka shift (atau manajer) yang dapat menutupnya");
  }
}

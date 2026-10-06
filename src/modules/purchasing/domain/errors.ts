import { DomainError } from "@/shared/kernel/errors";

export class SupplierNotFoundError extends DomainError {
  public readonly code = "SUPPLIER_NOT_FOUND";

  constructor() {
    super("Supplier tidak ditemukan");
  }
}

export class PurchaseOrderNotFoundError extends DomainError {
  public readonly code = "PO_NOT_FOUND";

  constructor() {
    super("Purchase order tidak ditemukan");
  }
}

export class InvalidPOStatusError extends DomainError {
  public readonly code = "INVALID_PO_STATUS";

  constructor(message: string) {
    super(message);
  }
}

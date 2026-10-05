export abstract class DomainError extends Error {
  public abstract readonly code: string;

  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends DomainError {
  public readonly code = "NOT_FOUND";

  constructor(entityName: string, id?: string | number) {
    const detail = id !== undefined ? ` with ID "${id}"` : "";
    super(`${entityName}${detail} not found`);
  }
}

export class ValidationError extends DomainError {
  public readonly code = "VALIDATION_ERROR";

  constructor(
    message: string,
    public readonly validationErrors?: Record<string, string[]>
  ) {
    super(message, validationErrors);
  }
}

export class AuthorizationError extends DomainError {
  public readonly code = "UNAUTHORIZED";

  constructor(message = "Unauthorized access or insufficient permissions") {
    super(message);
  }
}

export class ConflictError extends DomainError {
  public readonly code = "CONFLICT";

  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class InvariantViolationError extends DomainError {
  public readonly code = "INVARIANT_VIOLATION";

  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

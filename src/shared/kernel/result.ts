export type Ok<T> = {
  readonly success: true;
  readonly data: T;
  readonly error?: never;
};

export type Err<E> = {
  readonly success: false;
  readonly data?: never;
  readonly error: E;
};

export type Result<T, E = Error> = Ok<T> | Err<E>;

export function ok<T>(data: T): Ok<T> {
  return {
    success: true,
    data,
  };
}

export function err<E>(error: E): Err<E> {
  return {
    success: false,
    error,
  };
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.success;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.success;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.success) {
    return result.data;
  }
  if (result.error instanceof Error) {
    throw result.error;
  }
  throw new Error(String(result.error));
}

export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.success ? result.data : defaultValue;
}

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  return result.success ? ok(fn(result.data)) : result;
}

export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return result.success ? result : err(fn(result.error));
}

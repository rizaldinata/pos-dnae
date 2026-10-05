export type UUID = string;

export type Timestamp = string;

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type DeepReadonly<T> = T extends (infer R)[]
  ? ReadonlyArray<DeepReadonly<R>>
  : T extends (...args: unknown[]) => unknown
    ? T
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

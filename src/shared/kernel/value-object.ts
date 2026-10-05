export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  public equals(vo?: ValueObject<T> | null): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }

    if (vo.constructor.name !== this.constructor.name) {
      return false;
    }

    return this.shallowOrDeepEquals(this.props, vo.props);
  }

  private shallowOrDeepEquals(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (
      typeof a !== "object" ||
      a === null ||
      typeof b !== "object" ||
      b === null
    ) {
      return false;
    }

    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      const valA = (a as Record<string, unknown>)[key];
      const valB = (b as Record<string, unknown>)[key];
      if (!this.shallowOrDeepEquals(valA, valB)) return false;
    }

    return true;
  }
}

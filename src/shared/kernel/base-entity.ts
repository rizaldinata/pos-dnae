export interface EntityTimestamps {
  createdAt: Date;
  updatedAt: Date;
}

export abstract class BaseEntity<TProps, TId = string> {
  protected readonly _id: TId;
  protected _props: TProps;
  protected _createdAt: Date;
  protected _updatedAt: Date;

  constructor(props: TProps, id: TId, timestamps?: Partial<EntityTimestamps>) {
    this._id = id;
    this._props = props;
    this._createdAt = timestamps?.createdAt ?? new Date();
    this._updatedAt = timestamps?.updatedAt ?? new Date();
  }

  get id(): TId {
    return this._id;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  public equals(other?: BaseEntity<TProps, TId> | null): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (this === other) {
      return true;
    }

    if (!(other instanceof BaseEntity)) {
      return false;
    }

    return this._id === other._id;
  }
}

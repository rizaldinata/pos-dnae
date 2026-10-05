import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";

export interface UnitProps {
  name: string;
  shortName: string;
}

export class Unit extends BaseEntity<UnitProps> {
  private constructor(
    props: UnitProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: UnitProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Unit {
    return new Unit(
      { name: props.name.trim(), shortName: props.shortName.trim() },
      id,
      timestamps
    );
  }

  public get name(): string {
    return this._props.name;
  }

  public get shortName(): string {
    return this._props.shortName;
  }
}

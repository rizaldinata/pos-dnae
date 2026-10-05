import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";

export interface BrandProps {
  name: string;
}

export class Brand extends BaseEntity<BrandProps> {
  private constructor(
    props: BrandProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: BrandProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Brand {
    return new Brand({ name: props.name.trim() }, id, timestamps);
  }

  public get name(): string {
    return this._props.name;
  }
}

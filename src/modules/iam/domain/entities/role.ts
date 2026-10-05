import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";

export interface RoleProps {
  name: string;
  isSystem: boolean;
  permissions: string[];
}

export class Role extends BaseEntity<RoleProps> {
  private constructor(
    props: RoleProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: RoleProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Role {
    return new Role(props, id, timestamps);
  }

  public get name(): string {
    return this._props.name;
  }

  public get isSystem(): boolean {
    return this._props.isSystem;
  }

  public get permissions(): string[] {
    return [...this._props.permissions];
  }

  public hasPermission(code: string): boolean {
    return this._props.permissions.includes(code);
  }
}

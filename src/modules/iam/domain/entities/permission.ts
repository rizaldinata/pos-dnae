import { BaseEntity } from "@/shared/kernel/base-entity";

export interface PermissionProps {
  code: string;
  description: string;
}

export class Permission extends BaseEntity<PermissionProps> {
  private constructor(props: PermissionProps, id: string) {
    super(props, id);
  }

  public static create(props: PermissionProps, id: string): Permission {
    return new Permission(props, id);
  }

  public get code(): string {
    return this._props.code;
  }

  public get description(): string {
    return this._props.description;
  }
}

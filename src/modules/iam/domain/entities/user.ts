import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";

export interface UserProps {
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  isActive: boolean;
}

export class User extends BaseEntity<UserProps> {
  private constructor(
    props: UserProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: UserProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): User {
    return new User(props, id, timestamps);
  }

  public get email(): string {
    return this._props.email;
  }

  public get fullName(): string {
    return this._props.fullName;
  }

  public get roleId(): string {
    return this._props.roleId;
  }

  public get roleName(): string {
    return this._props.roleName;
  }

  public get permissions(): string[] {
    return [...this._props.permissions];
  }

  public get isActive(): boolean {
    return this._props.isActive;
  }

  public hasPermission(code: string): boolean {
    return this._props.permissions.includes(code);
  }

  public canLogin(): boolean {
    return this._props.isActive;
  }
}

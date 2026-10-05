import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type { User } from "@/modules/iam/domain/entities/user";

export interface CreateUserRecord {
  email: string;
  password: string;
  fullName: string;
  roleId: string;
}

export interface UpdateUserRecord {
  fullName?: string;
  roleId?: string;
  isActive?: boolean;
}

export interface IUserRepository {
  findById(id: string): Promise<Result<User | null, DomainError>>;
  findByEmail(email: string): Promise<Result<User | null, DomainError>>;
  findAll(): Promise<Result<User[], DomainError>>;
  create(record: CreateUserRecord): Promise<Result<User, DomainError>>;
  update(
    id: string,
    patch: UpdateUserRecord
  ): Promise<Result<User, DomainError>>;
}

import type { Result } from "@/shared/kernel/result";
import type { DomainError } from "@/shared/kernel/errors";
import type {
  Customer,
  CustomerHistory,
} from "@/modules/customers/domain/entities/customer";

export interface CreateCustomerRecord {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface UpdateCustomerRecord {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface CustomerFilter {
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerListResult {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ICustomerRepository {
  findById(id: string): Promise<Result<Customer | null, DomainError>>;
  search(
    filter: CustomerFilter
  ): Promise<Result<CustomerListResult, DomainError>>;
  create(record: CreateCustomerRecord): Promise<Result<Customer, DomainError>>;
  update(
    id: string,
    patch: UpdateCustomerRecord
  ): Promise<Result<Customer, DomainError>>;
  softDelete(id: string): Promise<Result<void, DomainError>>;
  getHistory(
    customerId: string,
    limit?: number
  ): Promise<Result<CustomerHistory, DomainError>>;
}

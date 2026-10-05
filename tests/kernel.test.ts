import { describe, expect, it } from "vitest";
import {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  mapErr,
  BaseEntity,
  ValueObject,
  NotFoundError,
  ValidationError,
  AuthorizationError,
  ConflictError,
  InvariantViolationError,
} from "@/shared/kernel";

// Test implementations of BaseEntity and ValueObject
interface UserProps {
  name: string;
  email: string;
}

class UserEntity extends BaseEntity<UserProps> {
  static create(id: string, props: UserProps): UserEntity {
    return new UserEntity(props, id);
  }

  get name(): string {
    return this._props.name;
  }
}

interface AddressProps {
  city: string;
  postalCode: string;
}

class AddressVO extends ValueObject<AddressProps> {
  static create(city: string, postalCode: string): AddressVO {
    return new AddressVO({ city, postalCode });
  }
}

describe("Shared Kernel", () => {
  describe("Result Type", () => {
    it("handles ok results properly", () => {
      const res = ok(42);
      expect(isOk(res)).toBe(true);
      expect(isErr(res)).toBe(false);
      expect(unwrap(res)).toBe(42);
      expect(unwrapOr(res, 0)).toBe(42);

      const mapped = map(res, (n) => n * 2);
      expect(unwrap(mapped)).toBe(84);
    });

    it("handles err results properly", () => {
      const res = err(new Error("failure"));
      expect(isOk(res)).toBe(false);
      expect(isErr(res)).toBe(true);
      expect(() => unwrap(res)).toThrowError("failure");
      expect(unwrapOr(res, 99)).toBe(99);

      const mappedErr = mapErr(res, (e) => new Error(`Wrapped: ${e.message}`));
      expect(isErr(mappedErr)).toBe(true);
      if (isErr(mappedErr)) {
        expect(mappedErr.error.message).toBe("Wrapped: failure");
      }
    });
  });

  describe("BaseEntity", () => {
    it("compares entities by identity id", () => {
      const user1 = UserEntity.create("u-1", {
        name: "Alice",
        email: "alice@test.com",
      });
      const user2 = UserEntity.create("u-1", {
        name: "Alice Updated",
        email: "alice@test.com",
      });
      const user3 = UserEntity.create("u-2", {
        name: "Alice",
        email: "alice@test.com",
      });

      expect(user1.equals(user2)).toBe(true);
      expect(user1.equals(user3)).toBe(false);
      expect(user1.equals(null)).toBe(false);
      expect(user1.id).toBe("u-1");
      expect(user1.createdAt).toBeInstanceOf(Date);
      expect(user1.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("ValueObject", () => {
    it("compares value objects by structural properties", () => {
      const addr1 = AddressVO.create("Jakarta", "10110");
      const addr2 = AddressVO.create("Jakarta", "10110");
      const addr3 = AddressVO.create("Bandung", "40115");

      expect(addr1.equals(addr2)).toBe(true);
      expect(addr1.equals(addr3)).toBe(false);
      expect(addr1.equals(null)).toBe(false);
    });
  });

  describe("Domain Errors", () => {
    it("creates standard error instances with codes", () => {
      const notFound = new NotFoundError("Product", "prod-123");
      expect(notFound.code).toBe("NOT_FOUND");
      expect(notFound.message).toContain(
        'Product with ID "prod-123" not found'
      );

      const validation = new ValidationError("Invalid payload", {
        code: ["Required"],
      });
      expect(validation.code).toBe("VALIDATION_ERROR");
      expect(validation.validationErrors?.code).toEqual(["Required"]);

      const auth = new AuthorizationError("Access denied");
      expect(auth.code).toBe("UNAUTHORIZED");

      const conflict = new ConflictError("Barcode already exists");
      expect(conflict.code).toBe("CONFLICT");

      const invariant = new InvariantViolationError("Shift already closed");
      expect(invariant.code).toBe("INVARIANT_VIOLATION");
    });
  });
});

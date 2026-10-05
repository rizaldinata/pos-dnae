import { describe, expect, it } from "vitest";
import { add } from "@/shared/lib/sample";

describe("Tooling & Vitest Setup", () => {
  it("should run tests successfully", () => {
    expect(1 + 1).toBe(2);
  });

  it("should resolve path aliases correctly", () => {
    expect(add(2, 3)).toBe(5);
  });
});

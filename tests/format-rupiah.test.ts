import { describe, expect, it } from "vitest";
import { formatRupiah, parseRupiah } from "@/shared/lib/format-rupiah";

describe("formatRupiah", () => {
  it("formats positive numbers to Rupiah string", () => {
    expect(formatRupiah(1000000)).toBe("Rp 1.000.000");
    expect(formatRupiah(50000)).toBe("Rp 50.000");
    expect(formatRupiah(0)).toBe("Rp 0");
  });

  it("formats numbers without prefix", () => {
    expect(formatRupiah(1500000, { withPrefix: false })).toBe("1.500.000");
  });

  it("handles negative numbers", () => {
    expect(formatRupiah(-25000)).toBe("-Rp 25.000");
    expect(formatRupiah(-25000, { withPrefix: false })).toBe("-25.000");
  });

  it("rounds floating point numbers to whole integer", () => {
    expect(formatRupiah(12500.75)).toBe("Rp 12.501");
    expect(formatRupiah(12500.25)).toBe("Rp 12.500");
  });

  it("parses formatted string back to number", () => {
    expect(parseRupiah("Rp 1.000.000")).toBe(1000000);
    expect(parseRupiah("50.000")).toBe(50000);
    expect(parseRupiah("-Rp 25.000")).toBe(-25000);
    expect(parseRupiah("invalid")).toBe(0);
  });
});

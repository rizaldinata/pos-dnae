import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/shared/lib/csv";

describe("parseCsv", () => {
  it("menparse CSV sederhana", () => {
    const rows = parseCsv("a,b,c\n1,2,3");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("menangani BOM UTF-8", () => {
    const rows = parseCsv("\uFEFFa,b");
    expect(rows).toEqual([["a", "b"]]);
  });

  it("menangani kutip ganda dan kutip di dalam kutip", () => {
    const rows = parseCsv('"a""b",c\n"d",e');
    expect(rows).toEqual([
      ['a"b', "c"],
      ["d", "e"],
    ]);
  });

  it("menangani CRLF", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("membuang baris kosong di akhir", () => {
    const rows = parseCsv("a,b\n1,2\n");
    expect(rows).toHaveLength(2);
  });
});

describe("toCsv", () => {
  it("men serialize baris dengan koma dan CRLF", () => {
    const text = toCsv([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(text).toBe("a,b\r\n1,2\r\n");
  });

  it("membungkus sel yang mengandung koma/kutip dengan kutip ganda", () => {
    const text = toCsv([["a,b", 'c"d']]);
    expect(text).toBe('"a,b","c""d"\r\n');
  });

  it("menangani null/undefined sebagai sel kosong", () => {
    const text = toCsv([[null, undefined, "x"]]);
    expect(text).toBe(",,x\r\n");
  });
});

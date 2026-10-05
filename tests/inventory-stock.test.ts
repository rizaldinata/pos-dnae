import { describe, expect, it } from "vitest";
import {
  StockPolicy,
  computeStockStatus,
} from "@/modules/inventory/domain/services/stock-policy";
import { movementTypeLabel } from "@/modules/inventory/domain/entities/stock";

describe("StockPolicy.canDeduct", () => {
  it("mengizinkan pengurangan bila stok cukup", () => {
    expect(StockPolicy.canDeduct(10, 4, false)).toBe(true);
  });

  it("mengizinkan pengurangan pas (stok jadi 0)", () => {
    expect(StockPolicy.canDeduct(10, 10, false)).toBe(true);
  });

  it("menolak pengurangan melebihi stok", () => {
    expect(StockPolicy.canDeduct(3, 4, false)).toBe(false);
  });

  it("mengizinkan stok minus bila pengaturan aktif", () => {
    expect(StockPolicy.canDeduct(3, 4, true)).toBe(true);
  });

  it("menolak qty tidak positif", () => {
    expect(StockPolicy.canDeduct(10, 0, true)).toBe(false);
    expect(StockPolicy.canDeduct(10, -2, true)).toBe(false);
  });
});

describe("computeStockStatus", () => {
  it("habis bila qty 0 atau negatif", () => {
    expect(computeStockStatus(0, 10)).toBe("habis");
    expect(computeStockStatus(-2, 10)).toBe("habis");
  });

  it("menipis bila qty <= min_stock", () => {
    expect(computeStockStatus(5, 5)).toBe("menipis");
    expect(computeStockStatus(3, 10)).toBe("menipis");
  });

  it("normal bila qty > min_stock", () => {
    expect(computeStockStatus(11, 10)).toBe("normal");
  });
});

describe("movementTypeLabel", () => {
  it("label bahasa Indonesia untuk semua tipe", () => {
    expect(movementTypeLabel("sale")).toBe("Penjualan");
    expect(movementTypeLabel("purchase")).toBe("Pembelian");
    expect(movementTypeLabel("adjust")).toBe("Penyesuaian");
    expect(movementTypeLabel("return_in")).toBe("Retur masuk");
    expect(movementTypeLabel("return_out")).toBe("Retur keluar");
    expect(movementTypeLabel("opname")).toBe("Opname");
    expect(movementTypeLabel("void")).toBe("Void");
  });
});

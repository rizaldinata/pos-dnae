import { describe, expect, it } from "vitest";
import { Sku } from "@/modules/catalog/domain/value-objects/sku";
import {
  Category,
  buildCategoryTree,
} from "@/modules/catalog/domain/entities/category";
import { ValidationError } from "@/shared/kernel/errors";

function makeCategory(
  id: string,
  name: string,
  parentId: string | null
): Category {
  return Category.create({ name, parentId }, id);
}

describe("Sku value object", () => {
  it("normalisasi ke huruf besar dan trim", () => {
    expect(Sku.create("  mie-grg ").value).toBe("MIE-GRG");
  });

  it("menolak SKU kosong", () => {
    expect(() => Sku.create("   ")).toThrow(ValidationError);
  });

  it("menolak karakter tidak valid", () => {
    expect(() => Sku.create("MIE GORENG!")).toThrow(ValidationError);
  });

  it("menerima karakter - _ . /", () => {
    expect(Sku.create("BRG-1_A.2/3").value).toBe("BRG-1_A.2/3");
  });
});

describe("buildCategoryTree", () => {
  it("membangun pohon bertingkat dengan urutan nama", () => {
    const categories = [
      makeCategory("c1", "Sembako", null),
      makeCategory("c2", "Bumbu Dapur", "c1"),
      makeCategory("c3", "Minuman", null),
      makeCategory("c4", "Sambal", "c2"),
    ];
    const tree = buildCategoryTree(categories);
    expect(tree.map((n) => n.category.name)).toEqual(["Minuman", "Sembako"]);
    const sembako = tree.find((n) => n.category.name === "Sembako");
    expect(sembako?.children.map((n) => n.category.name)).toEqual([
      "Bumbu Dapur",
    ]);
    expect(sembako?.children[0]?.children.map((n) => n.category.name)).toEqual([
      "Sambal",
    ]);
    expect(sembako?.children[0]?.children[0]?.depth).toBe(2);
  });
});

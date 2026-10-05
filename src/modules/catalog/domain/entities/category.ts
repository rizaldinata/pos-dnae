import { BaseEntity } from "@/shared/kernel/base-entity";
import type { EntityTimestamps } from "@/shared/kernel/base-entity";

export interface CategoryProps {
  name: string;
  parentId: string | null;
}

export class Category extends BaseEntity<CategoryProps> {
  private constructor(
    props: CategoryProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ) {
    super(props, id, timestamps);
  }

  public static create(
    props: CategoryProps,
    id: string,
    timestamps?: Partial<EntityTimestamps>
  ): Category {
    return new Category(
      { name: props.name.trim(), parentId: props.parentId },
      id,
      timestamps
    );
  }

  public get name(): string {
    return this._props.name;
  }

  public get parentId(): string | null {
    return this._props.parentId;
  }

  public isRoot(): boolean {
    return this._props.parentId === null;
  }
}

export interface CategoryNode {
  category: Category;
  children: CategoryNode[];
  depth: number;
}

export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) {
    const list = byParent.get(category.parentId) ?? [];
    list.push(category);
    byParent.set(category.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "id"));
  }

  const build = (parentId: string | null, depth: number): CategoryNode[] =>
    (byParent.get(parentId) ?? []).map((category) => ({
      category,
      children: build(category.id, depth + 1),
      depth,
    }));

  return build(null, 0);
}

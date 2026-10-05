import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { CategoryManagement } from "@/modules/catalog/presentation/components/category-management";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kategori — POS DNAE",
};

export default async function CategoriesPage() {
  const guard = await requirePermission("product.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const result = await container.catalog.listCategories.executeTree();
  if (isErr(result)) {
    throw new Error(result.error.message);
  }

  const flat = result.data.flatMap(function walk(node): {
    id: string;
    name: string;
    parentId: string | null;
    depth: number;
  }[] {
    return [
      {
        id: node.category.id,
        name: node.category.name,
        parentId: node.category.parentId,
        depth: node.depth,
      },
      ...node.children.flatMap(walk),
    ];
  });

  return <CategoryManagement categories={flat} />;
}

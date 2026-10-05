"use server";

import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import type { POSProduct } from "@/modules/sales/application/use-cases/search-products-pos.use-case";

export async function searchProductsPOSAction(
  query: string,
  limit = 24
): Promise<POSProduct[]> {
  const container = await getAppContainer();
  const current = await container.iam.getCurrentUser.execute();
  if (isErr(current) || current.data === null) {
    return [];
  }
  const result = await container.sales.searchProductsForPOS.execute(
    query,
    limit
  );
  if (isErr(result)) {
    return [];
  }
  return result.data;
}

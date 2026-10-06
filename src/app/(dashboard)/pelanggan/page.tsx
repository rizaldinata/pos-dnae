import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { Button } from "@/shared/ui/button";
import { CustomerManagement } from "@/modules/customers/presentation/components/customer-management";
import { CustomerSearch } from "@/modules/customers/presentation/components/customer-search";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pelanggan",
};

const PAGE_SIZE = 20;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const guard = await requirePermission("customer.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const query = params.q ?? "";
  const page = Math.max(Number(params.page) || 1, 1);

  const container = await getAppContainer();
  const result = await container.customers.listCustomers.execute({
    query,
    page,
    pageSize: PAGE_SIZE,
  });
  if (isErr(result)) {
    throw new Error(result.error.message);
  }
  const { items, total } = result.data;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex-1">
          <CustomerSearch initialQuery={query} />
        </div>
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/pelanggan/piutang">Piutang</Link>
        </Button>
      </div>
      <CustomerManagement
        customers={items.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          points: c.points,
          receivableBalance: c.receivableBalance,
        }))}
      />
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages} ({total} pelanggan)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild disabled={page <= 1}>
              <Link
                href={`/pelanggan${query ? `?q=${encodeURIComponent(query)}&` : "?"}page=${page - 1}`}
              >
                Sebelumnya
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page >= totalPages}
            >
              <Link
                href={`/pelanggan${query ? `?q=${encodeURIComponent(query)}&` : "?"}page=${page + 1}`}
              >
                Berikutnya
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { FinanceNav } from "@/modules/finance/presentation/components/finance-nav";
import {
  ExpenseManagement,
  type ExpenseDTO,
} from "@/modules/finance/presentation/components/expense-management";
import { OperationalFilters } from "@/modules/reporting/presentation/components/operational-filters";
import { toISODateJakarta } from "@/shared/lib/date";
import { isErr } from "@/shared/kernel/result";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pengeluaran",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ExpensePage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    categoryId?: string;
    page?: string;
  }>;
}) {
  const guard = await requirePermission("finance.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const today = toISODateJakarta(new Date());
  const dateFrom =
    params.from && DATE_RE.test(params.from)
      ? params.from
      : `${today.slice(0, 7)}-01`;
  const dateTo = params.to && DATE_RE.test(params.to) ? params.to : today;
  const categoryId =
    params.categoryId && UUID_RE.test(params.categoryId)
      ? params.categoryId
      : "";
  const page = Math.max(Number.parseInt(params.page ?? "1", 10) || 1, 1);

  const container = await getAppContainer();
  const [expensesResult, categoriesResult] = await Promise.all([
    container.finance.listExpenses.list({
      dateFrom,
      dateTo,
      categoryId: categoryId || undefined,
      page,
      pageSize: 20,
    }),
    container.finance.listExpenseCategories.execute(),
  ]);
  if (isErr(expensesResult)) {
    throw new Error(expensesResult.error.message);
  }
  if (isErr(categoriesResult)) {
    throw new Error(categoriesResult.error.message);
  }

  const categories = categoriesResult.data.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const categoryNames = Object.fromEntries(
    categories.map((c) => [c.id, c.name])
  );

  const expenses: ExpenseDTO[] = expensesResult.data.items.map((expense) => ({
    id: expense.id,
    categoryId: expense.categoryId,
    amount: expense.amount.amount,
    note: expense.note,
    expenseDate: expense.expenseDate,
  }));

  return (
    <div className="flex flex-col gap-4">
      <FinanceNav permissions={guard.user.permissions} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Keuangan</h1>
          <p className="text-sm text-muted-foreground">
            {dateFrom} s/d {dateTo}
            {categoryId ? ` — ${categoryNames[categoryId] ?? ""}` : ""}
          </p>
        </div>
        <OperationalFilters
          dateFrom={dateFrom}
          dateTo={dateTo}
          categories={categories}
          currentCategoryId={categoryId}
          showCategory
        />
      </div>
      <ExpenseManagement
        expenses={expenses}
        categories={categories}
        total={expensesResult.data.total}
        page={expensesResult.data.page}
        pageSize={expensesResult.data.pageSize}
      />
    </div>
  );
}

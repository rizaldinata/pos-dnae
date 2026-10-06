import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { SettingsNav } from "@/modules/settings/presentation/components/settings-nav";
import { AuditLogFilters } from "@/modules/settings/presentation/components/audit-log-filters";
import { formatDateTimeJakarta } from "@/shared/lib/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit Log — POS DNAE",
};

const PAGE_SIZE = 20;

function summarize(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  try {
    const text = JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  } catch {
    return "-";
  }
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const guard = await requirePermission("audit.view");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const params = await searchParams;
  const page = Math.max(Number(params.page) || 1, 1);

  const container = await getAppContainer();
  const [logsResult, actionsResult] = await Promise.all([
    container.settings.listAuditLogs.execute({
      action: params.action || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    container.settings.listAuditActions.execute(),
  ]);

  if (isErr(logsResult)) {
    throw new Error(logsResult.error.message);
  }
  if (isErr(actionsResult)) {
    throw new Error(actionsResult.error.message);
  }

  const { items, total } = logsResult.data;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex flex-col gap-4">
      <SettingsNav
        showUsers={guard.user.hasPermission("user.manage")}
        showAudit={guard.user.hasPermission("audit.view")}
        showRoles={guard.user.hasPermission("role.manage")}
      />
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          {total} peristiwa tercatat
        </p>
      </div>

      <AuditLogFilters
        actions={actionsResult.data}
        currentAction={params.action ?? ""}
        currentFrom={params.from ?? ""}
        currentTo={params.to ?? ""}
      />

      <Card>
        <CardHeader>
          <CardTitle>Aktivitas sensitif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTimeJakarta(entry.createdAt)}
                    </TableCell>
                    <TableCell>{entry.userName}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {entry.action}
                    </TableCell>
                    <TableCell className="max-w-72 truncate font-mono text-xs text-muted-foreground">
                      {summarize(entry.newValue ?? entry.oldValue)}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      Belum ada peristiwa
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Halaman {page} dari {totalPages}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

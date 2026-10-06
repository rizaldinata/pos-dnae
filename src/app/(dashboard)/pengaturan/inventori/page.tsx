import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { SettingsNav } from "@/modules/settings/presentation/components/settings-nav";
import { InventorySettingsForm } from "@/modules/settings/presentation/components/inventory-settings-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pengaturan Inventori — POS DNAE",
};

export default async function InventorySettingsPage() {
  const guard = await requirePermission("settings.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const result = await container.settings.getInventorySettings.execute();
  if (isErr(result)) {
    throw new Error(result.error.message);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SettingsNav
        showUsers={guard.user.hasPermission("user.manage")}
        showAudit={guard.user.hasPermission("audit.view")}
        showRoles={guard.user.hasPermission("role.manage")}
      />
      <div>
        <h1 className="text-2xl font-semibold">Pengaturan Inventori</h1>
        <p className="text-sm text-muted-foreground">
          Peringatan kedaluwarsa batch &amp; pelacakan FEFO
        </p>
      </div>
      <InventorySettingsForm initial={result.data} />
    </div>
  );
}

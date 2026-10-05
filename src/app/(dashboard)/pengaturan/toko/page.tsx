import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { SettingsNav } from "@/modules/settings/presentation/components/settings-nav";
import { StoreSettingsForm } from "@/modules/settings/presentation/components/store-settings-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pengaturan Toko — POS DNAE",
};

export default async function StoreSettingsPage() {
  const guard = await requirePermission("settings.manage");
  if (!guard.ok || guard.user.roleName !== "Owner") {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const result = await container.settings.getStoreSettings.execute();
  if (isErr(result)) {
    throw new Error(result.error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsNav showUsers={guard.user.hasPermission("user.manage")} />
      <div>
        <h1 className="text-2xl font-semibold">Pengaturan Toko</h1>
        <p className="text-sm text-muted-foreground">
          Data toko tampil di struk dan laporan
        </p>
      </div>
      <StoreSettingsForm initial={result.data} />
    </div>
  );
}

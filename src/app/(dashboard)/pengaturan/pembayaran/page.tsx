import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { isErr } from "@/shared/kernel/result";
import { SettingsNav } from "@/modules/settings/presentation/components/settings-nav";
import { PaymentMethodManagement } from "@/modules/settings/presentation/components/payment-method-management";
import { QrisSettingsCard } from "@/modules/settings/presentation/components/qris-settings-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Metode Pembayaran",
};

export default async function PaymentMethodsPage() {
  const guard = await requirePermission("settings.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const container = await getAppContainer();
  const [methods, settings] = await Promise.all([
    container.settings.listPaymentMethods.execute(),
    container.settings.getStoreSettings.execute(),
  ]);
  if (isErr(methods)) {
    throw new Error(methods.error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsNav
        showUsers={guard.user.hasPermission("user.manage")}
        showAudit={guard.user.hasPermission("audit.view")}
        showRoles={guard.user.hasPermission("role.manage")}
      />
      <PaymentMethodManagement
        methods={methods.data.map((m) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          isActive: m.isActive,
        }))}
      />
      <QrisSettingsCard
        initialUrl={isErr(settings) ? "" : settings.data.qrisImageUrl}
      />
    </div>
  );
}

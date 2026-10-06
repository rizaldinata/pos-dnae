import { redirect } from "next/navigation";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";
import { RoleManagement } from "@/modules/iam/presentation/components/role-management";
import { SettingsNav } from "@/modules/settings/presentation/components/settings-nav";
import { listRolesAction } from "@/modules/iam/presentation/actions/role.action";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Role & Permission",
};

export default async function RolesPage() {
  const guard = await requirePermission("role.manage");
  if (!guard.ok) {
    redirect("/forbidden");
  }

  const { roles, permissions } = await listRolesAction();

  return (
    <div className="flex flex-col gap-4">
      <SettingsNav
        showUsers={guard.user.hasPermission("user.manage")}
        showAudit={guard.user.hasPermission("audit.view")}
        showRoles={true}
      />
      <RoleManagement roles={roles} permissions={permissions} />
    </div>
  );
}

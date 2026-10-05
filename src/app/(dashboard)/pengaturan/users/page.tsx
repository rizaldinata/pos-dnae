import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import { UserManagement } from "@/modules/iam/presentation/components/user-management";
import { SettingsNav } from "@/modules/settings/presentation/components/settings-nav";

export const metadata = {
  title: "Pengguna — POS DNAE",
};

export default async function UsersPage() {
  const container = await getAppContainer();

  const currentResult = await container.iam.getCurrentUser.execute();
  if (isErr(currentResult) || currentResult.data === null) {
    redirect("/login");
  }
  const currentUser = currentResult.data;
  if (!currentUser.hasPermission("user.manage")) {
    redirect("/forbidden");
  }

  const usersResult = await container.iam.listUsers.execute();
  if (isErr(usersResult)) {
    throw new Error(usersResult.error.message);
  }

  const rolesResult = await container.iam.listRoles.execute();
  if (isErr(rolesResult)) {
    throw new Error(rolesResult.error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsNav showUsers={true} />
      <UserManagement
        users={usersResult.data.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          roleId: u.roleId,
          roleName: u.roleName,
          isActive: u.isActive,
        }))}
        roles={rolesResult.data.map((r) => ({ id: r.id, name: r.name }))}
        currentUserId={currentUser.id}
      />
    </div>
  );
}

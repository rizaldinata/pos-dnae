import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import { Sidebar } from "@/modules/iam/presentation/components/sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const container = await getAppContainer();
  const result = await container.iam.getCurrentUser.execute();

  if (isErr(result) || result.data === null) {
    redirect("/login");
  }

  const user = result.data;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col lg:flex-row">
        <Sidebar
          user={{
            fullName: user.fullName,
            roleName: user.roleName,
            permissions: user.permissions,
          }}
        />
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

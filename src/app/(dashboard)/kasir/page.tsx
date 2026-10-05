import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import { KasirScreen } from "@/modules/sales/presentation/components/kasir-screen";
import { getCurrentShiftAction } from "@/modules/shifts/presentation/actions/shift.action";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kasir — POS DNAE",
};

export default async function KasirPage() {
  const container = await getAppContainer();
  const result = await container.iam.getCurrentUser.execute();
  if (isErr(result) || result.data === null) {
    redirect("/login");
  }

  const initialShift = await getCurrentShiftAction();

  return (
    <KasirScreen
      userName={result.data.fullName}
      roleName={result.data.roleName}
      initialShift={initialShift}
    />
  );
}

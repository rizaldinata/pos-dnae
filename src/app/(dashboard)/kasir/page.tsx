import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { isErr } from "@/shared/kernel/result";
import { KasirScreen } from "@/modules/sales/presentation/components/kasir-screen";
import { getCurrentShiftAction } from "@/modules/shifts/presentation/actions/shift.action";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kasir",
};

export default async function KasirPage() {
  const container = await getAppContainer();
  const result = await container.iam.getCurrentUser.execute();
  if (isErr(result) || result.data === null) {
    redirect("/login");
  }

  const [initialShift, pricing] = await Promise.all([
    getCurrentShiftAction(),
    (async () => {
      const pricingResult =
        await container.settings.getPricingSettings.execute();
      return isErr(pricingResult)
        ? { taxRate: 0, taxMode: "exclusive" as const, serviceFeeRate: 0 }
        : pricingResult.data;
    })(),
  ]);

  return (
    <KasirScreen
      userName={result.data.fullName}
      roleName={result.data.roleName}
      initialShift={initialShift}
      initialPricing={pricing}
    />
  );
}

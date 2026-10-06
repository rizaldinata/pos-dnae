import { redirect } from "next/navigation";
import { requirePermission } from "@/modules/iam/presentation/actions/require-permission";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Keuangan — POS DNAE",
};

/** Pintasan /keuangan: arahkan pengguna ke halaman yang boleh dia lihat. */
export default async function FinanceIndexPage() {
  const canManage = await requirePermission("finance.manage");
  if (canManage.ok) {
    redirect("/keuangan/pengeluaran");
  }
  const canReport = await requirePermission("report.view");
  if (canReport.ok) {
    redirect("/keuangan/arus-kas");
  }
  redirect("/forbidden");
}

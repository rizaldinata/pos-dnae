import { LoginForm } from "@/modules/iam/presentation/components/login-form";
import { PinLoginSection } from "@/modules/iam/presentation/components/pin-login-section";

export const metadata = {
  title: "Masuk",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const notice =
    params.reason === "inactive"
      ? "Akun Anda sudah dinonaktifkan. Hubungi Owner."
      : undefined;

  return (
    <div className="flex flex-col items-center gap-4">
      <LoginForm notice={notice} />
      <PinLoginSection />
    </div>
  );
}

import { LoginForm } from "@/modules/iam/presentation/components/login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Masuk — POS DNAE",
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

  return <LoginForm notice={notice} />;
}

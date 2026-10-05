"use server";

import { redirect } from "next/navigation";
import { getAppContainer } from "@/di/container";
import { createSupabaseServerClient } from "@/shared/infrastructure/supabase/server-client";

export interface AuthActionState {
  message: string | null;
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const container = await getAppContainer();
  const result = await container.iam.login.execute({ email, password });

  if (!result.success) {
    return { message: result.error.message };
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

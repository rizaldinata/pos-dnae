"use client";

import { useActionState } from "react";
import {
  loginAction,
  type AuthActionState,
} from "@/modules/iam/presentation/actions/auth.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

const initialState: AuthActionState = { message: null };

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>POS DNAE</CardTitle>
        <CardDescription>Masuk untuk mengelola toko Anda</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="owner@pos.local"
              required
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium">
              Kata sandi
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={isPending}
            />
          </div>
          {(state.message || notice) && (
            <p role="alert" className="text-sm text-destructive">
              {state.message ?? notice}
            </p>
          )}
          <Button type="submit" disabled={isPending} className="min-h-11">
            {isPending ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

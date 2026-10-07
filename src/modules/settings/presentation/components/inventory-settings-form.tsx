"use client";

import { useState, useTransition } from "react";
import { updateInventorySettingsAction } from "@/modules/settings/presentation/actions/settings.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export interface InventorySettingsInitial {
  expiryWarningDays: number;
}

export function InventorySettingsForm({
  initial,
}: {
  initial: InventorySettingsInitial;
}) {
  const [expiryWarningDays, setExpiryWarningDays] = useState(
    String(initial.expiryWarningDays)
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("expiryWarningDays", expiryWarningDays);
    startTransition(async () => {
      const result = await updateInventorySettingsAction(
        { success: false, message: null },
        formData
      );
      setMessage({ ok: result.success, text: result.message ?? "" });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peringatan kedaluwarsa</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="expiry-warning-days"
              className="text-sm font-medium"
            >
              Tampilkan peringatan berapa hari sebelum kedaluwarsa
            </label>
            <Input
              id="expiry-warning-days"
              type="number"
              min={1}
              max={365}
              value={expiryWarningDays}
              onChange={(e) => setExpiryWarningDays(e.target.value)}
              disabled={pending}
              className="min-h-11 sm:max-w-40"
            />
            <p className="text-xs text-muted-foreground">
              Batch dengan qty &gt; 0 yang sudah lewat atau mendekati tanggal
              kedaluwarsa muncul di badge sidebar, dasbor, dan halaman
              Kedaluwarsa. Rentang 1–365 hari.
            </p>
          </div>
          {message && (
            <p
              role={message.ok ? "status" : "alert"}
              className={`text-sm ${message.ok ? "text-green-600" : "text-destructive"}`}
            >
              {message.text}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            loading={pending}
            className="min-h-11"
          >
            {pending ? "Menyimpan..." : "Simpan pengaturan inventori"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

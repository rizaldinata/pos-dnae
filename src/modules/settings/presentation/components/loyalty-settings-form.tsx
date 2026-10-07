"use client";

import { useState, useTransition } from "react";
import { updateLoyaltySettingsAction } from "@/modules/settings/presentation/actions/settings.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export interface LoyaltySettingsInitial {
  earnRatio: number;
  pointValue: number;
}

export function LoyaltySettingsForm({
  initial,
}: {
  initial: LoyaltySettingsInitial;
}) {
  const [earnRatio, setEarnRatio] = useState(String(initial.earnRatio));
  const [pointValue, setPointValue] = useState(String(initial.pointValue));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("earnRatio", earnRatio);
    formData.set("pointValue", pointValue);
    startTransition(async () => {
      const result = await updateLoyaltySettingsAction(
        { success: false, message: null },
        formData
      );
      setMessage({ ok: result.success, text: result.message ?? "" });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rasio loyalitas</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="earn-ratio" className="text-sm font-medium">
                Rasio perolehan (Rp belanja / poin)
              </label>
              <Input
                id="earn-ratio"
                type="number"
                min={0}
                max={10000000}
                value={earnRatio}
                onChange={(e) => setEarnRatio(e.target.value)}
                disabled={pending}
                className="min-h-11"
              />
              <p className="text-xs text-muted-foreground">
                Contoh 10000: setiap Rp10.000 belanja memberi 1 poin. Isi 0
                untuk menonaktifkan perolehan poin.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="point-value" className="text-sm font-medium">
                Nilai poin (Rp / poin)
              </label>
              <Input
                id="point-value"
                type="number"
                min={0}
                max={1000000}
                value={pointValue}
                onChange={(e) => setPointValue(e.target.value)}
                disabled={pending}
                className="min-h-11"
              />
              <p className="text-xs text-muted-foreground">
                Contoh 100: 100 poin bernilai Rp10.000 saat ditukar. Isi 0 untuk
                menonaktifkan penukaran poin.
              </p>
            </div>
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
            {pending ? "Menyimpan..." : "Simpan loyalitas"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

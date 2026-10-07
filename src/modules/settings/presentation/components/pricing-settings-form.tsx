"use client";

import { useState, useTransition } from "react";
import { updatePricingSettingsAction } from "@/modules/settings/presentation/actions/settings.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export interface PricingSettingsInitial {
  taxRate: number;
  taxMode: "inclusive" | "exclusive";
  serviceFeeRate: number;
}

export function PricingSettingsForm({
  initial,
}: {
  initial: PricingSettingsInitial;
}) {
  const [taxRate, setTaxRate] = useState(String(initial.taxRate));
  const [taxMode, setTaxMode] = useState<"inclusive" | "exclusive">(
    initial.taxMode
  );
  const [serviceFeeRate, setServiceFeeRate] = useState(
    String(initial.serviceFeeRate)
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("taxRate", taxRate);
    formData.set("taxMode", taxMode);
    formData.set("serviceFee", serviceFeeRate);
    startTransition(async () => {
      const result = await updatePricingSettingsAction(
        { success: false, message: null },
        formData
      );
      setMessage({ ok: result.success, text: result.message ?? "" });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pajak & biaya layanan</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="tax-rate" className="text-sm font-medium">
                PPN (%)
              </label>
              <Input
                id="tax-rate"
                type="number"
                min={0}
                max={100}
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                disabled={pending}
                className="min-h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="tax-mode" className="text-sm font-medium">
                Mode pajak
              </label>
              <select
                id="tax-mode"
                value={taxMode}
                onChange={(e) =>
                  setTaxMode(e.target.value as "inclusive" | "exclusive")
                }
                disabled={pending}
                className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="exclusive">Eksklusif (ditambah)</option>
                <option value="inclusive">Inklusif (termasuk)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="service-fee" className="text-sm font-medium">
                Layanan (%)
              </label>
              <Input
                id="service-fee"
                type="number"
                min={0}
                max={100}
                value={serviceFeeRate}
                onChange={(e) => setServiceFeeRate(e.target.value)}
                disabled={pending}
                className="min-h-11"
              />
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
            {pending ? "Menyimpan..." : "Simpan pajak & layanan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

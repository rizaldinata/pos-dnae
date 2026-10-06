"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import type { ExportType } from "@/modules/reporting/presentation/export/dataset";

type Kind = "excel" | "pdf" | "csv";

/**
 * Tombol Ekspor Excel / PDF / CSV (RPT-06, PRD-06): mengunduh file dari route
 * handler dan memicu download otomatis di browser setelah file siap.
 * Prop `csv` menampilkan tombol CSV (format polos, siap diimpor ulang).
 */
export function ExportButtons({
  type,
  pdf,
  csv,
  query,
}: {
  type: ExportType;
  pdf?: boolean;
  csv?: boolean;
  query?: Record<string, string | number | undefined | null>;
}) {
  const [pending, setPending] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(kind: Kind) {
    setPending(kind);
    setError(null);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value));
        }
      }
      if (kind === "csv") {
        params.set("format", "csv");
      }
      const qs = params.toString();
      const base = kind === "pdf" ? "/api/reports/pdf" : "/api/reports/export";
      const response = await fetch(`${base}/${type}${qs ? `?${qs}` : ""}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "Gagal membuat file ekspor");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download =
        match?.[1] ??
        (kind === "excel"
          ? `${type}.xlsx`
          : kind === "csv"
            ? `${type}.csv`
            : `${type}.pdf`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat file ekspor");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => download("excel")}
        >
          {pending === "excel" ? "Menyiapkan..." : "Ekspor Excel"}
        </Button>
        {csv && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() => download("csv")}
          >
            {pending === "csv" ? "Menyiapkan..." : "Ekspor CSV"}
          </Button>
        )}
        {pdf && (
          <Button
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() => download("pdf")}
          >
            {pending === "pdf" ? "Menyiapkan..." : "Ekspor PDF"}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

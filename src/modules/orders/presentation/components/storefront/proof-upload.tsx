"use client";

import { useRef, useState } from "react";
import { Button } from "@/shared/ui/button";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Unggah bukti bayar QRIS (field "file" → POST multipart).
 * Setelah sukses komponen menampilkan status terkirim tanpa refresh halaman.
 */
export function ProofUpload({ orderNo }: { orderNo: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    const input = inputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setError("Pilih berkas bukti pembayaran terlebih dahulu.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Ukuran berkas maksimal 5 MB.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(
        `/api/storefront/orders/${encodeURIComponent(orderNo)}/proof`,
        { method: "POST", body: form }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        setError(payload.message ?? "Gagal mengunggah bukti. Coba lagi.");
        return;
      }
      setDone(true);
    } catch {
      setError("Jaringan bermasalah. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
        Bukti pembayaran sudah dikirim — menunggu verifikasi staf.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Unggah bukti pembayaran</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          setFileName(e.target.files?.[0]?.name ?? null);
          setError(null);
        }}
        className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-sm"
        aria-label="Berkas bukti pembayaran"
      />
      {fileName ? (
        <p className="text-xs text-muted-foreground">Berkas: {fileName}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        onClick={handleUpload}
        loading={pending}
        disabled={pending}
        className="min-h-11 w-fit"
      >
        {pending ? "Mengunggah..." : "Kirim bukti pembayaran"}
      </Button>
    </div>
  );
}

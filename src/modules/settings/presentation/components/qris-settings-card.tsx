"use client";

import { useRef, useState, useTransition } from "react";
import { uploadQrisImageAction } from "@/modules/settings/presentation/actions/settings.action";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

/**
 * Pengaturan gambar QRIS toko (Pengaturan → Pembayaran). Gambar ditampilkan
 * di halaman publik saat pelanggan memilih pembayaran QRIS.
 */
export function QrisSettingsCard({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, startUploading] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(file: File | undefined) {
    if (!file) {
      return;
    }
    const formData = new FormData();
    formData.set("qris", file);
    setMessage(null);
    startUploading(async () => {
      const result = await uploadQrisImageAction(formData);
      if (result.success && result.url) {
        setUrl(result.url);
        setMessage("Gambar QRIS berhasil diunggah");
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>QRIS</CardTitle>
        <CardDescription>
          Gambar kode QRIS toko untuk pembayaran pesanan online dari halaman
          publik. Pelanggan mengunggah bukti transfer, staf memverifikasi di
          halaman Pesanan.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Kode QRIS toko"
            className="max-h-64 w-fit rounded-md border bg-white p-2"
          />
        ) : (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Gambar QRIS belum dipasang — pelanggan belum bisa memilih pembayaran
            QRIS.
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => handleChange(e.target.files?.[0])}
          className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-sm"
          aria-label="Berkas gambar QRIS"
        />
        {message ? (
          <p className="text-xs text-muted-foreground">{message}</p>
        ) : null}
        <Button
          variant="outline"
          className="min-h-10 w-fit"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading
            ? "Mengunggah..."
            : url
              ? "Ganti gambar QRIS"
              : "Unggah gambar QRIS"}
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import {
  importProductsAction,
  previewImportProductsAction,
  type ImportProductsState,
  type ImportPreviewState,
} from "@/modules/catalog/presentation/actions/product.action";
import type { ImportRowPreview } from "@/modules/catalog/domain/services/import-policy";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { formatRupiah } from "@/shared/lib/format-rupiah";

/** Batas baris yang ditampilkan di tabel pratinjau (performa browser). */
const MAX_DISPLAY_ROWS = 200;

export function ProductImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportRowPreview[] | null>(null);
  const [newMasters, setNewMasters] = useState<{
    categories: string[];
    brands: string[];
    units: string[];
  }>({ categories: [], brands: [], units: [] });
  const [result, setResult] = useState<ImportProductsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePreview() {
    if (!file) {
      setError("Pilih file terlebih dahulu");
      return;
    }
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const state: ImportPreviewState =
        await previewImportProductsAction(formData);
      if (!state.ok) {
        setError(state.message);
        setPreview(null);
        return;
      }
      setPreview(state.rows);
      setNewMasters({
        categories: state.newCategories,
        brands: state.newBrands,
        units: state.newUnits,
      });
    });
  }

  function handleImport() {
    if (!preview) {
      return;
    }
    const entries = preview
      .filter((row) => row.errors.length === 0)
      .map((row) => ({ line: row.line, values: row.values }));
    if (entries.length === 0) {
      setError("Tidak ada baris valid untuk diimpor");
      return;
    }
    setError(null);
    startTransition(async () => {
      const state = await importProductsAction(entries);
      setResult(state);
      if (state.success) {
        setPreview(null);
        setFile(null);
        if (fileRef.current) {
          fileRef.current.value = "";
        }
      }
    });
  }

  function reset() {
    setPreview(null);
    setResult(null);
    setError(null);
    setFile(null);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  const validRows =
    preview?.filter((row) => row.errors.length === 0).length ?? 0;
  const errorRows = preview ? preview.length - validRows : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Pilih File</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx"
            disabled={pending}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            aria-label="File impor produk"
          />
          <div>
            <Button onClick={handlePreview} disabled={pending || !file}>
              {pending ? "Memvalidasi..." : "Periksa & Validasi"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>2. Pratinjau Data</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Total {preview.length} baris</Badge>
              <Badge variant="success">Valid {validRows}</Badge>
              {errorRows > 0 && (
                <Badge variant="destructive">Bermasalah {errorRows}</Badge>
              )}
            </div>

            {(newMasters.categories.length > 0 ||
              newMasters.brands.length > 0 ||
              newMasters.units.length > 0) && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Master baru yang akan dibuat:</p>
                {newMasters.categories.length > 0 && (
                  <p className="text-muted-foreground">
                    Kategori: {newMasters.categories.join(", ")}
                  </p>
                )}
                {newMasters.brands.length > 0 && (
                  <p className="text-muted-foreground">
                    Brand: {newMasters.brands.join(", ")}
                  </p>
                )}
                {newMasters.units.length > 0 && (
                  <p className="text-muted-foreground">
                    Satuan: {newMasters.units.join(", ")}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Baris</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead className="text-right">Hrg modal</TableHead>
                    <TableHead className="text-right">Hrg jual</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, MAX_DISPLAY_ROWS).map((row) => (
                    <TableRow
                      key={row.line}
                      className={
                        row.errors.length > 0 ? "bg-destructive/5" : ""
                      }
                    >
                      <TableCell className="font-mono text-xs">
                        {row.line}
                      </TableCell>
                      <TableCell>{row.name || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.sku || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.barcode || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.costPrice !== null
                          ? formatRupiah(row.costPrice)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.sellPrice !== null
                          ? formatRupiah(row.sellPrice)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {row.errors.length > 0 ? (
                          <span className="text-xs text-destructive">
                            {row.errors.join("; ")}
                          </span>
                        ) : (
                          <Badge variant="success">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {preview.length > MAX_DISPLAY_ROWS && (
              <p className="text-xs text-muted-foreground">
                Menampilkan {MAX_DISPLAY_ROWS} baris pertama dari{" "}
                {preview.length} baris.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleImport}
                disabled={pending || validRows === 0}
              >
                {pending ? "Mengimpor..." : `Impor ${validRows} baris valid`}
              </Button>
              <Button variant="outline" onClick={reset} disabled={pending}>
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>3. Hasil Impor</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={result.success ? "success" : "destructive"}>
                {result.message}
              </Badge>
              {result.imported !== undefined && (
                <Badge variant="secondary">Berhasil {result.imported}</Badge>
              )}
              {result.failed !== undefined && result.failed > 0 && (
                <Badge variant="destructive">Gagal {result.failed}</Badge>
              )}
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Baris</TableHead>
                      <TableHead>Pesan Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((err, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">
                          {err.line}
                        </TableCell>
                        <TableCell className="text-xs text-destructive">
                          {err.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div>
              <Button variant="outline" onClick={reset}>
                Impor File Lain
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

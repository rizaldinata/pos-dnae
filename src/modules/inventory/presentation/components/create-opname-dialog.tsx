"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOpnameAction } from "@/modules/inventory/presentation/actions/opname.action";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

export function CreateOpnameDialog({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createOpnameAction(categoryId || null);
      if (!result.success || !result.opnameId) {
        setMessage(result.message ?? "Gagal membuat sesi");
        return;
      }
      setOpen(false);
      router.push(`/stok/opname/${result.opnameId}`);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="min-h-11">
        Buat sesi opname
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sesi stock opname baru</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="opname-scope" className="text-sm font-medium">
              Cakupan produk
            </label>
            <select
              id="opname-scope"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={pending}
              className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Semua produk</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Stok sistem saat ini disalin sebagai pembanding (snapshot).
            </p>
          </div>
          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button
              onClick={handleCreate}
              loading={pending}
              disabled={pending}
              className="min-h-11"
            >
              {pending ? "Membuat..." : "Buat sesi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

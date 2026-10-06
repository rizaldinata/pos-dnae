"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelPOAction,
  sendPOAction,
} from "@/modules/purchasing/presentation/actions/purchasing.action";
import { Button } from "@/shared/ui/button";

export function POActions({
  poId,
  status,
  canCancel,
}: {
  poId: string;
  status: string;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    action: (
      id: string
    ) => Promise<{ success: boolean; message: string | null }>
  ) {
    startTransition(async () => {
      const result = await action(poId);
      if (!result.success) {
        setMessage(result.message ?? "Gagal");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <Button
            disabled={pending}
            onClick={() => run(sendPOAction)}
            className="min-h-11"
          >
            {pending ? "Memproses..." : "Kirim ke supplier"}
          </Button>
        )}
        {canCancel && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (confirm("Batalkan PO ini?")) {
                run(cancelPOAction);
              }
            }}
            className="min-h-11"
          >
            Batalkan PO
          </Button>
        )}
      </div>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

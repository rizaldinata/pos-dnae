"use client";

import { Button } from "@/shared/ui/button";

export function PrintReceiptButton() {
  return (
    <Button
      variant="outline"
      onClick={() => window.print()}
      className="min-h-11 flex-1"
    >
      Cetak struk
    </Button>
  );
}

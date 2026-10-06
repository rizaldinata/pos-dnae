"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listPinUsersAction,
  type PinUserDTO,
} from "@/modules/iam/presentation/actions/pin.action";
import { PinPad } from "@/modules/iam/presentation/components/pin-pad";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { RefreshCw } from "lucide-react";

export function SwitchCashierButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<PinUserDTO[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    listPinUsersAction().then((list) => {
      if (!cancelled) {
        setUsers(list);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full justify-start hover:bg-sidebar-hover"
      >
        <RefreshCw className="size-4" />
        Ganti kasir (PIN)
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ganti kasir</DialogTitle>
            <DialogDescription>
              Pilih pengguna dan masukkan PIN-nya
            </DialogDescription>
          </DialogHeader>
          <PinPad
            users={users}
            actionLabel="Ganti"
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

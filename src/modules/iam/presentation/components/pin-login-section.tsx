"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listPinUsersAction,
  type PinUserDTO,
} from "@/modules/iam/presentation/actions/pin.action";
import { PinPad } from "@/modules/iam/presentation/components/pin-pad";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function PinLoginSection() {
  const router = useRouter();
  const [users, setUsers] = useState<PinUserDTO[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPinUsersAction().then((list) => {
      if (!cancelled) {
        setUsers(list);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (users === null || users.length === 0) {
    return null;
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-base">Masuk cepat dengan PIN</CardTitle>
      </CardHeader>
      <CardContent>
        <PinPad
          users={users}
          onSuccess={() => {
            router.push("/");
            router.refresh();
          }}
        />
      </CardContent>
    </Card>
  );
}

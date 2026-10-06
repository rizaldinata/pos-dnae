"use client";

import { useState, useTransition } from "react";
import {
  loginWithPinAction,
  type PinUserDTO,
} from "@/modules/iam/presentation/actions/pin.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

const PAD_KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "clear",
  "0",
  "back",
] as const;

export function PinPad({
  users,
  onSuccess,
  actionLabel = "Masuk",
}: {
  users: PinUserDTO[];
  onSuccess: () => void;
  actionLabel?: string;
}) {
  const [selectedId, setSelectedId] = useState<string>(users[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function press(key: (typeof PAD_KEYS)[number]) {
    if (pending) {
      return;
    }
    setMessage(null);
    if (key === "clear") {
      setPin("");
    } else if (key === "back") {
      setPin((prev) => prev.slice(0, -1));
    } else if (pin.length < 6) {
      setPin((prev) => prev + key);
    }
  }

  function handleSubmit() {
    if (!selectedId || pin.length < 4) {
      setMessage("Pilih pengguna dan masukkan PIN 4-6 digit");
      return;
    }
    startTransition(async () => {
      const result = await loginWithPinAction(selectedId, pin);
      if (!result.success) {
        setMessage(result.message ?? "PIN salah");
        setPin("");
        return;
      }
      onSuccess();
    });
  }

  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada pengguna dengan PIN. Minta Owner mengatur PIN.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        aria-label="Pilih pengguna"
        value={selectedId}
        onChange={(e) => {
          setSelectedId(e.target.value);
          setPin("");
          setMessage(null);
        }}
        disabled={pending}
        className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.fullName} • {u.roleName}
          </option>
        ))}
      </select>
      <Input
        value={"•".repeat(pin.length)}
        readOnly
        aria-label="PIN"
        placeholder="••••"
        className="min-h-12 text-center text-2xl tracking-widest"
      />
      <div className="grid grid-cols-3 gap-2">
        {PAD_KEYS.map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => press(key)}
            className="min-h-14 text-lg"
          >
            {key === "clear" ? "C" : key === "back" ? "⌫" : key}
          </Button>
        ))}
      </div>
      {message && (
        <p role="alert" className="text-center text-sm text-destructive">
          {message}
        </p>
      )}
      <Button
        onClick={handleSubmit}
        disabled={pending || pin.length < 4}
        aria-label="Masuk dengan PIN"
        className="min-h-11"
      >
        {pending ? "Memproses..." : actionLabel}
      </Button>
    </div>
  );
}

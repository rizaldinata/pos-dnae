"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  searchCustomersAction,
  type CustomerDTO,
} from "@/modules/customers/presentation/actions/customer.action";
import { useCartStore } from "@/modules/sales/presentation/hooks/use-cart-store";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { X } from "lucide-react";

export function CustomerPicker() {
  const selected = useCartStore((s) => s.selectedCustomer);
  const selectCustomer = useCartStore((s) => s.selectCustomer);
  const clearCustomer = useCartStore((s) => s.clearCustomer);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerDTO[]>([]);
  const [focused, setFocused] = useState(false);
  const [, startTransition] = useTransition();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, []);

  function handleChange(next: string) {
    setQuery(next);
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    if (!next.trim()) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(() => {
      startTransition(async () => {
        setResults(await searchCustomersAction(next.trim(), 8));
      });
    }, 300);
  }

  if (selected) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-1 text-sm">
        <span className="font-medium">{selected.name}</span>
        <Badge variant="secondary">{selected.points} poin</Badge>
        {selected.receivableBalance > 0 && (
          <Badge variant="destructive">
            Piutang Rp {selected.receivableBalance.toLocaleString("id-ID")}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8"
          aria-label="Lepas pelanggan"
          onClick={clearCustomer}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder="Pilih pelanggan (opsional)..."
        className="min-h-11"
        aria-label="Pilih pelanggan"
      />
      {focused && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-background shadow-lg">
          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className="flex min-h-11 w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  selectCustomer(customer);
                  setQuery("");
                  setResults([]);
                }}
              >
                <span className="font-medium">{customer.name}</span>
                {customer.phone && (
                  <span className="text-xs text-muted-foreground">
                    {customer.phone}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listReceivablesAction,
  recordReceivablePaymentAction,
  type ReceivableCustomerDTO,
} from "@/modules/customers/presentation/actions/receivable.action";
import {
  listActivePaymentMethodsAction,
  type PaymentMethodDTO,
} from "@/modules/sales/presentation/actions/checkout.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
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

export function ReceivableManagement() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ReceivableCustomerDTO[]>([]);
  const [paying, setPaying] = useState<ReceivableCustomerDTO | null>(null);
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("");
  const [methods, setMethods] = useState<PaymentMethodDTO[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh(nextQuery: string) {
    startTransition(async () => {
      setRows(await listReceivablesAction(nextQuery || undefined));
    });
  }

  useEffect(() => {
    refresh("");
    listActivePaymentMethodsAction().then((list) => {
      setMethods(list);
      setMethodId(list.find((m) => m.isCash)?.id ?? list[0]?.id ?? "");
    });
  }, []);

  function handlePay() {
    if (!paying) {
      return;
    }
    startTransition(async () => {
      const result = await recordReceivablePaymentAction({
        customerId: paying.customerId,
        amount: Math.round(Number(amount) || 0),
        paymentMethodId: methodId || null,
      });
      if (!result.success) {
        setMessage(result.message ?? "Gagal mencatat");
        return;
      }
      setMessage(result.message);
      setPaying(null);
      setAmount("");
      refresh(query);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Piutang Pelanggan</h1>
        <p className="text-sm text-muted-foreground">
          Penjualan kredit yang belum dilunasi
        </p>
      </div>

      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          refresh(e.target.value);
        }}
        placeholder="Cari pelanggan..."
        className="min-h-11 max-w-sm"
        aria-label="Cari piutang"
      />

      <Card>
        <CardHeader>
          <CardTitle>Saldo piutang</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.customerId}>
                    <TableCell className="font-medium">
                      <a
                        href={`/pelanggan/${row.customerId}`}
                        className="hover:underline"
                      >
                        {row.customerName}
                      </a>
                      {row.phone && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {row.phone}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatRupiah(row.balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPaying(row);
                          setAmount(String(row.balance));
                          setMessage(null);
                        }}
                      >
                        Bayar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      Tidak ada piutang
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {paying && (
        <Card>
          <CardHeader>
            <CardTitle>
              Bayar piutang {paying.customerName} • sisa{" "}
              {formatRupiah(paying.balance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="recv-amount" className="text-sm font-medium">
                  Nominal
                </label>
                <Input
                  id="recv-amount"
                  type="number"
                  min={1}
                  max={paying.balance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={pending}
                  className="min-h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="recv-method" className="text-sm font-medium">
                  Metode
                </label>
                <select
                  id="recv-method"
                  value={methodId}
                  onChange={(e) => setMethodId(e.target.value)}
                  disabled={pending}
                  className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handlePay}
                disabled={pending}
                loading={pending}
                className="min-h-11"
              >
                {pending ? "Menyimpan..." : "Catat pembayaran"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setPaying(null)}
                disabled={pending}
                className="min-h-11"
              >
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

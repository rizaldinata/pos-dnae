"use client";

import { useState, useTransition } from "react";
import { recordSupplierPaymentAction } from "@/modules/purchasing/presentation/actions/debt.action";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
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

export interface DebtRow {
  poId: string;
  poNo: string;
  supplierName: string;
  total: number;
  paid: number;
  remaining: number;
  dueDate: string | null;
  isPaid: boolean;
  isOverdue: boolean;
}

export function SupplierDebtManagement({ debts }: { debts: DebtRow[] }) {
  const [paying, setPaying] = useState<DebtRow | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Tunai");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openPay(debt: DebtRow) {
    setPaying(debt);
    setAmount(String(debt.remaining));
    setMessage(null);
  }

  function handlePay() {
    if (!paying) {
      return;
    }
    startTransition(async () => {
      const result = await recordSupplierPaymentAction(
        paying.poId,
        Math.round(Number(amount) || 0),
        method
      );
      if (!result.success) {
        setMessage(result.message ?? "Gagal mencatat");
        return;
      }
      setMessage(result.message);
      setPaying(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Hutang Supplier</h1>
        <p className="text-sm text-muted-foreground">
          Pembayaran bertahap per PO • jatuh tempo = tanggal PO + termin
        </p>
      </div>

      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daftar hutang</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Dibayar</TableHead>
                  <TableHead className="text-right">Sisa</TableHead>
                  <TableHead>Jatuh tempo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((debt) => (
                  <TableRow key={debt.poId}>
                    <TableCell className="font-mono text-xs">
                      {debt.poNo}
                    </TableCell>
                    <TableCell>{debt.supplierName}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(debt.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(debt.paid)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatRupiah(debt.remaining)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {debt.dueDate ?? "-"}
                    </TableCell>
                    <TableCell>
                      {debt.isPaid ? (
                        <Badge variant="default">Lunas</Badge>
                      ) : debt.isOverdue ? (
                        <Badge variant="destructive">Jatuh tempo</Badge>
                      ) : (
                        <Badge variant="secondary">Belum lunas</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!debt.isPaid && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPay(debt)}
                        >
                          Bayar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {debts.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      Tidak ada hutang
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
              Bayar {paying.poNo} • sisa {formatRupiah(paying.remaining)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="debt-amount" className="text-sm font-medium">
                  Nominal
                </label>
                <Input
                  id="debt-amount"
                  type="number"
                  min={1}
                  max={paying.remaining}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={pending}
                  className="min-h-11"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="debt-method" className="text-sm font-medium">
                  Metode
                </label>
                <select
                  id="debt-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  disabled={pending}
                  className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {["Tunai", "Transfer Bank", "QRIS", "E-Wallet", "Kartu"].map(
                    (m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    )
                  )}
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

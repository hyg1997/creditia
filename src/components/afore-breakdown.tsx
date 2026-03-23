"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { formatMXN } from "@/lib/formatters";

interface AforeTotals {
  sar92: number;
  sar92Rendimientos: number;
  sar97: number;
  sar97Rendimientos: number;
  rcvTrabajador: number;
  rcvTrabajadorRendimientos: number;
  rcvPatron: number;
  rcvPatronRendimientos: number;
  vivienda92: number;
  vivienda92Rendimientos: number;
  vivienda97: number;
  vivienda97Rendimientos: number;
}

interface AforeBreakdownProps {
  afore: {
    totals: AforeTotals;
    saldoAfore: number;
    saldoRCV: number;
  };
}

export function AforeBreakdown({ afore }: AforeBreakdownProps) {
  const { totals } = afore;

  const rows = [
    {
      concepto: "SAR 92",
      aportacion: totals.sar92,
      rendimientos: totals.sar92Rendimientos,
      subtotal: totals.sar92 + totals.sar92Rendimientos,
    },
    {
      concepto: "SAR 97",
      aportacion: totals.sar97,
      rendimientos: totals.sar97Rendimientos,
      subtotal: totals.sar97 + totals.sar97Rendimientos,
    },
    {
      concepto: "Vivienda 92",
      aportacion: totals.vivienda92,
      rendimientos: totals.vivienda92Rendimientos,
      subtotal: totals.vivienda92 + totals.vivienda92Rendimientos,
    },
    {
      concepto: "Vivienda 97",
      aportacion: totals.vivienda97,
      rendimientos: totals.vivienda97Rendimientos,
      subtotal: totals.vivienda97 + totals.vivienda97Rendimientos,
    },
  ];

  const rcvRows = [
    {
      concepto: "RCV Trabajador (1.125%)",
      aportacion: totals.rcvTrabajador,
      rendimientos: totals.rcvTrabajadorRendimientos,
      subtotal: totals.rcvTrabajador + totals.rcvTrabajadorRendimientos,
    },
    {
      concepto: "RCV Patron (3.15%)",
      aportacion: totals.rcvPatron,
      rendimientos: totals.rcvPatronRendimientos,
      subtotal: totals.rcvPatron + totals.rcvPatronRendimientos,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Desglose Saldo AFORE</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Aportacion</TableHead>
                <TableHead className="text-right">Rendimientos</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.concepto}>
                  <TableCell className="font-medium">{row.concepto}</TableCell>
                  <TableCell className="text-right">
                    {formatMXN(row.aportacion)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMXN(row.rendimientos)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMXN(row.subtotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total AFORE</TableCell>
                <TableCell className="text-right font-bold">
                  {formatMXN(rows.reduce((s, r) => s + r.aportacion, 0))}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {formatMXN(rows.reduce((s, r) => s + r.rendimientos, 0))}
                </TableCell>
                <TableCell className="text-right font-bold text-primary">
                  {formatMXN(afore.saldoAfore)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            RCV (No incluido en Saldo AFORE)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Aportacion</TableHead>
                <TableHead className="text-right">Rendimientos</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rcvRows.map((row) => (
                <TableRow key={row.concepto}>
                  <TableCell className="font-medium">{row.concepto}</TableCell>
                  <TableCell className="text-right">
                    {formatMXN(row.aportacion)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMXN(row.rendimientos)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMXN(row.subtotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Total RCV</TableCell>
                <TableCell className="text-right font-bold">
                  {formatMXN(rcvRows.reduce((s, r) => s + r.aportacion, 0))}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {formatMXN(rcvRows.reduce((s, r) => s + r.rendimientos, 0))}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {formatMXN(afore.saldoRCV)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

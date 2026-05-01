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

interface SubcuentaTotal {
  aportaciones: number;
  rendimientos: number;
  total: number;
}

interface AforeBreakdownProps {
  afore: {
    sar92: SubcuentaTotal;
    vivienda92: SubcuentaTotal;
    retiro: SubcuentaTotal;
    ceavTrabajador: SubcuentaTotal;
    ceavPatron: SubcuentaTotal;
    cuotaSocial: SubcuentaTotal;
    vivienda97: SubcuentaTotal;
    totalRCV: number;
    totalSAR92: number;
    totalVivienda: number;
    saldoTotal: number;
  };
}

function SubcuentaTable({ title, rows, totalLabel, totalAmount }: {
  title: string;
  rows: { concepto: string; aportacion: number; rendimientos: number; subtotal: number }[];
  totalLabel: string;
  totalAmount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs sm:text-sm font-semibold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-5">
        <div className="overflow-x-auto -mx-3 sm:-mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] sm:text-xs">Concepto</TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs">Aportación</TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs">Rendimientos</TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.concepto}>
                  <TableCell className="font-medium text-[10px] sm:text-xs">{row.concepto}</TableCell>
                  <TableCell className="text-right text-[10px] sm:text-xs font-mono">
                    {formatMXN(row.aportacion)}
                  </TableCell>
                  <TableCell className="text-right text-[10px] sm:text-xs font-mono">
                    {formatMXN(row.rendimientos)}
                  </TableCell>
                  <TableCell className="text-right text-[10px] sm:text-xs font-mono font-semibold">
                    {formatMXN(row.subtotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold text-[10px] sm:text-xs">{totalLabel}</TableCell>
                <TableCell className="text-right font-bold text-[10px] sm:text-xs font-mono">
                  {formatMXN(rows.reduce((s, r) => s + r.aportacion, 0))}
                </TableCell>
                <TableCell className="text-right font-bold text-[10px] sm:text-xs font-mono">
                  {formatMXN(rows.reduce((s, r) => s + r.rendimientos, 0))}
                </TableCell>
                <TableCell className="text-right font-bold text-[10px] sm:text-xs font-mono text-wv-cyan">
                  {formatMXN(totalAmount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function AforeBreakdown({ afore }: AforeBreakdownProps) {
  const saldoAfore = afore.totalSAR92 + afore.retiro.total;

  const aforeRows = [
    {
      concepto: "SAR 92",
      aportacion: afore.sar92.aportaciones,
      rendimientos: afore.sar92.rendimientos,
      subtotal: afore.sar92.total,
    },
    {
      concepto: "SAR 97 (Retiro)",
      aportacion: afore.retiro.aportaciones,
      rendimientos: afore.retiro.rendimientos,
      subtotal: afore.retiro.total,
    },
  ];

  const rcvRows = [
    {
      concepto: "Trabajador (1.125%)",
      aportacion: afore.ceavTrabajador.aportaciones,
      rendimientos: afore.ceavTrabajador.rendimientos,
      subtotal: afore.ceavTrabajador.total,
    },
    {
      concepto: "Patrón (3.15%)",
      aportacion: afore.ceavPatron.aportaciones,
      rendimientos: afore.ceavPatron.rendimientos,
      subtotal: afore.ceavPatron.total,
    },
    ...(afore.cuotaSocial.aportaciones > 0
      ? [
          {
            concepto: "Cuota Social",
            aportacion: afore.cuotaSocial.aportaciones,
            rendimientos: afore.cuotaSocial.rendimientos,
            subtotal: afore.cuotaSocial.total,
          },
        ]
      : []),
  ];

  const viviendaRows = [
    {
      concepto: "Vivienda 92",
      aportacion: afore.vivienda92.aportaciones,
      rendimientos: afore.vivienda92.rendimientos,
      subtotal: afore.vivienda92.total,
    },
    {
      concepto: "Vivienda 97",
      aportacion: afore.vivienda97.aportaciones,
      rendimientos: afore.vivienda97.rendimientos,
      subtotal: afore.vivienda97.total,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
      <SubcuentaTable
        title="Saldo AFORE (SAR)"
        rows={aforeRows}
        totalLabel="Total SAR"
        totalAmount={saldoAfore}
      />
      <SubcuentaTable
        title="RCV"
        rows={rcvRows}
        totalLabel="Total RCV"
        totalAmount={afore.totalRCV}
      />
      <SubcuentaTable
        title="Vivienda (INFONAVIT)"
        rows={viviendaRows}
        totalLabel="Total Vivienda"
        totalAmount={afore.totalVivienda}
      />
    </div>
  );
}

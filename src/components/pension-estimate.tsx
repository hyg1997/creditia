"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMXN, formatNumber } from "@/lib/formatters";

interface PensionEstimateProps {
  pension: {
    sbcPromedioDiario: number;
    sbcPromedioMensual: number;
    semanasReconocidas: number;
    grupoSalarial: number;
    cuantiaBasicaPct: number;
    incrementoAnualPct: number;
    anosExcedentes: number;
    porcentajeTotal: number;
    estimaciones: {
      edad: number;
      factorEdad: number;
      pensionMensual: number;
    }[];
    pensionMinima: number;
  };
}

export function PensionEstimate({ pension }: PensionEstimateProps) {
  return (
    <Card>
      <div className="px-3.5 sm:px-5 pt-4 sm:pt-5 pb-2">
        <p className="text-xs sm:text-sm font-semibold tracking-tight mb-2.5 sm:mb-3">
          Pensión Mensual Estimada (Ley 73 - Art. 167)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Grupo salarial</p>
            <p className="text-base sm:text-lg font-bold font-mono mt-0.5">{pension.grupoSalarial}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cuantía básica</p>
            <p className="text-base sm:text-lg font-bold font-mono mt-0.5">
              {formatNumber(pension.cuantiaBasicaPct, 2)}%
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Años excedentes</p>
            <p className="text-base sm:text-lg font-bold font-mono mt-0.5">{pension.anosExcedentes}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">% Total</p>
            <p className="text-base sm:text-lg font-bold font-mono mt-0.5">
              {formatNumber(pension.porcentajeTotal, 2)}%
            </p>
          </div>
        </div>
      </div>
      <CardContent className="px-3 sm:px-5">
        <div className="overflow-x-auto -mx-3 sm:-mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] sm:text-xs">Edad de retiro</TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs">Factor</TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs">Pensión mensual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pension.estimaciones.map((e) => (
                <TableRow
                  key={e.edad}
                  className={e.edad === 65 ? "font-bold bg-wv-cyan/5" : ""}
                >
                  <TableCell className="text-[10px] sm:text-xs">
                    {e.edad} años{" "}
                    {e.edad === 65 ? "(Vejez)" : "(Cesantía)"}
                  </TableCell>
                  <TableCell className="text-right text-[10px] sm:text-xs font-mono">
                    {formatNumber(e.factorEdad * 100, 0)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-[10px] sm:text-xs font-semibold">
                    {formatMXN(e.pensionMensual)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-2.5 sm:mt-3 leading-relaxed">
          Pensión mínima garantizada: {formatMXN(pension.pensionMinima)} (1 UMA
          mensual). Cálculo basado en SBC promedio de{" "}
          {formatMXN(pension.sbcPromedioDiario)}/día ×{" "}
          {formatNumber(pension.porcentajeTotal, 2)}% × factor por edad. No
          incluye aguinaldo ni asignaciones familiares.
        </p>
      </CardContent>
    </Card>
  );
}

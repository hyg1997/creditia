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
  TableFooter,
} from "@/components/ui/table";
import { formatMXN, formatDate, formatNumber } from "@/lib/formatters";

interface Period {
  fechaAlta: string;
  fechaBaja: string;
  salarioDiario: number;
  dias: number;
  semanasTotales: number;
  semanasContadas: number;
  resultado: number;
}

interface SalaryAverageBreakdownProps {
  promedio: number;
  periods: Period[];
}

export function SalaryAverageBreakdown({
  promedio,
  periods,
}: SalaryAverageBreakdownProps) {
  const totalSemanas = periods.reduce((s, p) => s + p.semanasTotales, 0);
  const totalContadas = periods.reduce((s, p) => s + p.semanasContadas, 0);
  const totalResultado = periods.reduce((s, p) => s + p.resultado, 0);

  return (
    <Card>
      <div className="px-3.5 sm:px-5 pt-4 sm:pt-5 pb-2">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-gradient-to-br from-wv-cyan/10 to-wv-surface rounded-lg p-2.5 sm:p-3 border border-wv-cyan/30">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Promedio diario</p>
            <p className="text-sm sm:text-lg font-bold font-mono text-wv-cyan mt-0.5">{formatMXN(promedio)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Promedio mensual</p>
            <p className="text-sm sm:text-lg font-bold font-mono mt-0.5">{formatMXN(promedio * 30.4)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sem. contadas</p>
            <p className="text-sm sm:text-lg font-bold font-mono mt-0.5">{formatNumber(totalContadas, 2)}<span className="text-muted-foreground font-normal text-[10px] sm:text-xs"> / 250</span></p>
          </div>
        </div>
      </div>
      <CardContent className="px-3 sm:px-5">
        <div className="overflow-x-auto -mx-3 sm:-mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[24px] text-[10px] sm:text-xs">#</TableHead>
                <TableHead className="text-[10px] sm:text-xs">Inicio</TableHead>
                <TableHead className="text-[10px] sm:text-xs">Término</TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs">Salario</TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs hidden sm:table-cell">Sem. Tot.</TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs">Sem. Cont.</TableHead>
                <TableHead className="text-right text-[10px] sm:text-xs">Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((period, index) => {
                const isActive = period.semanasContadas > 0;
                const isCapped = isActive && period.semanasContadas < period.semanasTotales;
                return (
                  <TableRow
                    key={index}
                    className={
                      isCapped
                        ? "bg-amber-500/10"
                        : !isActive
                          ? "text-muted-foreground"
                          : ""
                    }
                  >
                    <TableCell className="text-[10px] sm:text-xs text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="whitespace-nowrap text-[10px] sm:text-xs">
                      {formatDate(period.fechaAlta)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[10px] sm:text-xs">
                      {formatDate(period.fechaBaja)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[10px] sm:text-xs">
                      {formatMXN(period.salarioDiario)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[10px] sm:text-xs hidden sm:table-cell">
                      {formatNumber(period.semanasTotales, 2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[10px] sm:text-xs">
                      {formatNumber(period.semanasContadas, 2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-[10px] sm:text-xs">
                      {formatMXN(period.resultado)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-bold text-[10px] sm:text-xs">
                  Totales
                </TableCell>
                <TableCell className="text-right font-bold text-[10px] sm:text-xs font-mono hidden sm:table-cell">
                  {formatNumber(totalSemanas, 2)}
                </TableCell>
                <TableCell className="text-right font-bold text-[10px] sm:text-xs font-mono">
                  {formatNumber(totalContadas, 2)}
                </TableCell>
                <TableCell className="text-right font-bold text-[10px] sm:text-xs font-mono text-wv-cyan">
                  {formatMXN(totalResultado)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={5} className="font-bold text-[10px] sm:text-xs hidden sm:table-cell">
                  Promedio (Total / 250 semanas)
                </TableCell>
                <TableCell colSpan={4} className="font-bold text-[10px] sm:text-xs sm:hidden">
                  Promedio
                </TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-right font-bold text-wv-cyan text-sm sm:text-base font-mono">
                  {formatMXN(promedio)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {periods.some((p) => p.semanasContadas < p.semanasTotales && p.semanasContadas > 0) && (
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-2.5 sm:mt-3">
            Los períodos resaltados fueron recortados para completar exactamente 250 semanas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

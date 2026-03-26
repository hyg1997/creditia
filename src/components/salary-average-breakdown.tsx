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
  const activePeriods = periods.filter((p) => p.semanasContadas > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Salario Promedio de las ultimas 250 semanas
        </CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Promedio diario</p>
            <p className="text-xl font-bold text-primary">{formatMXN(promedio)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Promedio mensual</p>
            <p className="text-xl font-bold">{formatMXN(promedio * 30.4)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Semanas contadas</p>
            <p className="text-xl font-bold">{formatNumber(totalContadas, 2)} / 250</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[40px]">#</TableHead>
                <TableHead>Fecha Inicio</TableHead>
                <TableHead>Fecha Termino</TableHead>
                <TableHead className="text-right">Salario Diario</TableHead>
                <TableHead className="text-right">Semanas Totales</TableHead>
                <TableHead className="text-right">Semanas Contadas</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activePeriods.map((period, index) => (
                <TableRow
                  key={index}
                  className={period.semanasContadas < period.semanasTotales ? "bg-amber-50 dark:bg-amber-950/20" : ""}
                >
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(period.fechaAlta)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(period.fechaBaja)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMXN(period.salarioDiario)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(period.semanasTotales, 2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(period.semanasContadas, 2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatMXN(period.resultado)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-bold">
                  Totales
                </TableCell>
                <TableCell className="text-right font-bold">
                  {formatNumber(totalSemanas, 2)}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {formatNumber(totalContadas, 2)}
                </TableCell>
                <TableCell className="text-right font-bold text-primary">
                  {formatMXN(totalResultado)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={6} className="font-bold">
                  Promedio (Total / 250 semanas)
                </TableCell>
                <TableCell className="text-right font-bold text-primary text-lg">
                  {formatMXN(promedio)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {periods.some((p) => p.semanasContadas < p.semanasTotales && p.semanasContadas > 0) && (
          <p className="text-xs text-muted-foreground mt-3">
            Los periodos resaltados fueron recortados para completar exactamente 250 semanas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

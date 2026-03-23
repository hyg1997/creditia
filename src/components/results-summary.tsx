"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMXN, formatNumber } from "@/lib/formatters";

interface ResultsSummaryProps {
  saldoAfore: number;
  saldoRCV: number;
  promedioSalarial: number;
  totalSemanas: number;
  totalRecords: number;
}

export function ResultsSummary({
  saldoAfore,
  saldoRCV,
  promedioSalarial,
  totalSemanas,
  totalRecords,
}: ResultsSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Saldo AFORE Estimado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary">
            {formatMXN(saldoAfore)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            SAR + Vivienda + Rendimientos
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Promedio Salarial (250 sem.)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {formatMXN(promedioSalarial)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Diario | {formatMXN(promedioSalarial * 30.4)} mensual
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Semanas Cotizadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{totalSemanas}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalRecords} registros laborales
          </p>
        </CardContent>
      </Card>

      <Card className="md:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            RCV (Retiro, Cesantia y Vejez)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatMXN(saldoRCV)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Aportaciones de trabajador ({formatNumber(1.125)}%) + patron ({formatNumber(3.15)}%) + rendimientos — se calcula por separado del saldo AFORE
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

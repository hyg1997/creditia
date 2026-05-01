"use client";

import { formatMXN } from "@/lib/formatters";

interface ResultsSummaryProps {
  saldoAforeRegresar: number;
  saldoSAR: number;
  saldoRCV: number;
  saldoVivienda: number;
  promedioSalarial: number;
  totalSemanas: number;
  totalRecords: number;
}

export function ResultsSummary({
  saldoAforeRegresar,
  saldoSAR,
  saldoRCV,
  saldoVivienda,
  promedioSalarial,
  totalSemanas,
  totalRecords,
}: ResultsSummaryProps) {
  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Row 1: Saldo AFORE a Regresar — full width, prominent */}
      <div className="bg-gradient-to-br from-wv-surface to-wv-cyan/10 border border-wv-cyan/30 text-foreground rounded-xl sm:rounded-[16px] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 sm:gap-4">
          <div>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-wv-label font-medium">
              Saldo AFORE a Regresar
            </p>
            <p className="text-3xl sm:text-[40px] font-bold font-mono leading-tight mt-1 tracking-tight">
              {formatMXN(saldoAforeRegresar)}
            </p>
          </div>
          <p className="text-[10px] sm:text-[11px] text-wv-label sm:pb-1">
            SAR 92 + SAR 97 + Vivienda (pago único al pensionarte)
          </p>
        </div>
      </div>

      {/* Row 2: SAR, RCV, Vivienda — 3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-wv-label font-medium">
            SAR (Retiro 92 + 97)
          </p>
          <p className="text-xl sm:text-[28px] font-bold font-mono leading-tight mt-1 tracking-tight">
            {formatMXN(saldoSAR)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 sm:mt-1.5">
            Pago único al pensionarte
          </p>
        </div>

        <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-wv-label font-medium">
            RCV (Cesantía y Vejez)
          </p>
          <p className="text-xl sm:text-[28px] font-bold font-mono leading-tight mt-1 tracking-tight">
            {formatMXN(saldoRCV)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 sm:mt-1.5">
            Complementa tu pensión IMSS
          </p>
        </div>

        <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-wv-label font-medium">
            Vivienda (INFONAVIT)
          </p>
          <p className="text-xl sm:text-[28px] font-bold font-mono leading-tight mt-1 tracking-tight">
            {formatMXN(saldoVivienda)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 sm:mt-1.5">
            Puede ser $0 si usaste crédito
          </p>
        </div>
      </div>

      {/* Row 3: Promedio Salarial + Semanas — 2 columns */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-wv-label font-medium">
            Promedio Salarial
          </p>
          <p className="text-xl sm:text-[28px] font-bold font-mono leading-tight mt-1 tracking-tight">
            {formatMXN(promedioSalarial)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 sm:mt-1.5">
            Diario | {formatMXN(promedioSalarial * 30.4)} mensual
          </p>
        </div>

        <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-wv-label font-medium">
            Semanas Cotizadas
          </p>
          <p className="text-xl sm:text-[28px] font-bold font-mono leading-tight mt-1 tracking-tight">
            {totalSemanas}
          </p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 sm:mt-1.5">
            {totalRecords > 0 ? `${totalRecords} registros laborales` : "Datos extraídos del PDF"}
          </p>
        </div>
      </div>
    </div>
  );
}

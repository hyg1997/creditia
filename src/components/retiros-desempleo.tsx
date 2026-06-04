"use client";

import { useState, useMemo } from "react";
import { formatMXN } from "@/lib/formatters";

interface RetiroParcial {
  fechaBaja: string;
  fechaReingreso: string;
  diasDesempleo: number;
  salarioDiario: number;
  montoRetiro: number;
  topeAplicado: boolean;
}

interface RetirosDesempleoProps {
  retiros: RetiroParcial[];
  semanasDescontadas: number;
  totalRCVBruto: number;
  semanasReconocidas: number;
}

function parseDDMMYYYY(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const ANOS_ENTRE_RETIROS = 5;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_5_YEARS = ANOS_ENTRE_RETIROS * 365.25 * MS_PER_DAY;

function isCurrentGap(fechaReingreso: string): boolean {
  const date = parseDDMMYYYY(fechaReingreso);
  const now = new Date();
  return Math.abs(date.getTime() - now.getTime()) < 2 * MS_PER_DAY;
}

export function RetirosDesempleo({
  retiros,
  semanasDescontadas,
  totalRCVBruto,
  semanasReconocidas,
}: RetirosDesempleoProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const fechasBaja = useMemo(
    () => retiros.map((r) => parseDDMMYYYY(r.fechaBaja).getTime()),
    [retiros]
  );

  const disabledIndices = useMemo(() => {
    const disabled = new Set<number>();
    for (const selIdx of selected) {
      const selTime = fechasBaja[selIdx];
      for (let i = 0; i < retiros.length; i++) {
        if (i === selIdx) continue;
        if (selected.has(i)) continue;
        const diff = Math.abs(fechasBaja[i] - selTime);
        if (diff < MS_5_YEARS) {
          disabled.add(i);
        }
      }
    }
    return disabled;
  }, [selected, fechasBaja, retiros.length]);

  const valorPorSemana =
    semanasReconocidas > 0 ? totalRCVBruto / semanasReconocidas : 0;

  const totalDevolver = semanasDescontadas * valorPorSemana;

  const maxRetiroSeleccion = useMemo(() => {
    let total = 0;
    for (const idx of selected) {
      total += retiros[idx].montoRetiro;
    }
    return total;
  }, [selected, retiros]);

  function toggleSelection(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  if (retiros.length === 0 && semanasDescontadas === 0) return null;

  return (
    <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-4">
        {/* Alert: semanas descontadas */}
        {semanasDescontadas > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-wv-red/10 border border-wv-red/20 px-3 py-2">
            <svg
              className="w-4 h-4 text-wv-red shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="text-xs sm:text-sm">
              <span className="font-semibold text-wv-red">
                {semanasDescontadas} semanas descontadas
              </span>
              <span className="text-muted-foreground">
                {" "}registradas en la constancia por retiro(s) parcial(es)
              </span>
            </p>
          </div>
        )}

        {/* Calculation: monto a devolver from semanas descontadas */}
        {semanasDescontadas > 0 && valorPorSemana > 0 && (
          <div className="space-y-2.5">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cálculo del monto a devolver
            </p>
            <div className="rounded-lg bg-muted/40 border border-wv-border p-3 space-y-2 font-mono text-xs sm:text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-muted-foreground">Valor por semana</span>
                <span>=</span>
                <span className="text-muted-foreground">Saldo RCV bruto</span>
                <span>/</span>
                <span className="text-muted-foreground">Semanas reconocidas</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-muted-foreground">Valor por semana</span>
                <span>=</span>
                <span>{formatMXN(totalRCVBruto)}</span>
                <span>/</span>
                <span>{semanasReconocidas}</span>
                <span>=</span>
                <span className="font-semibold">{formatMXN(valorPorSemana)}</span>
              </div>
              <div className="border-t border-wv-border/50 pt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-muted-foreground">Total a devolver</span>
                <span>=</span>
                <span>{semanasDescontadas} sem.</span>
                <span>&times;</span>
                <span>{formatMXN(valorPorSemana)}</span>
                <span>=</span>
                <span className="font-bold text-sm sm:text-base text-wv-red">
                  {formatMXN(totalDevolver)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Eligible periods table */}
        {retiros.length > 0 ? (
          <div className="space-y-2.5">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Periodos de desempleo elegibles para retiro parcial
            </p>
            <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-wv-border text-left">
                    <th className="pb-2 pr-2 text-center w-8"></th>
                    <th className="pb-2 pr-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Baja
                    </th>
                    <th className="pb-2 pr-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Reingreso
                    </th>
                    <th className="pb-2 pr-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                      Días
                    </th>
                    <th className="pb-2 pr-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                      Último SBC
                    </th>
                    <th className="pb-2 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                      Máx. retiro posible
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {retiros.map((r, i) => {
                    const isSelected = selected.has(i);
                    const isDisabled = disabledIndices.has(i);
                    const isCurrent = isCurrentGap(r.fechaReingreso);
                    return (
                      <tr
                        key={i}
                        className={`border-b border-wv-border/50 transition-colors ${
                          isDisabled
                            ? "opacity-40"
                            : isSelected
                              ? "bg-wv-cyan/5"
                              : "hover:bg-wv-hover"
                        }`}
                      >
                        <td className="py-2 pr-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => toggleSelection(i)}
                            className="h-3.5 w-3.5 rounded border-wv-border text-wv-cyan focus:ring-wv-cyan focus:ring-offset-0 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-2 pr-3 font-mono">{r.fechaBaja}</td>
                        <td className="py-2 pr-3 font-mono">
                          {isCurrent
                            ? <span className="text-wv-cyan italic">Actual</span>
                            : r.fechaReingreso}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {r.diasDesempleo}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {formatMXN(r.salarioDiario)}
                        </td>
                        <td className="py-2 text-right font-mono text-muted-foreground">
                          {formatMXN(r.montoRetiro)}
                          {r.topeAplicado && (
                            <span className="text-[9px] text-wv-cyan ml-1" title="Tope 10× UMA mensual aplicado">
                              *
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Comparison when selections made */}
            {selected.size > 0 && (
              <div className="rounded-lg border border-wv-border bg-muted/40 p-3 space-y-2.5">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Verificación de selección
                </p>
                <div className="font-mono text-xs sm:text-sm space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-muted-foreground">Máx. retiro posible ({selected.size} periodo{selected.size > 1 ? "s" : ""}):</span>
                    <span className="font-semibold">{formatMXN(maxRetiroSeleccion)}</span>
                    <span className="text-[10px] text-muted-foreground">(30 días × SBC de cada periodo)</span>
                  </div>
                  {semanasDescontadas > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-muted-foreground">Monto real a devolver (según constancia):</span>
                      <span className="font-bold text-wv-red">{formatMXN(totalDevolver)}</span>
                      <span className="text-[10px] text-muted-foreground">({semanasDescontadas} sem. × {formatMXN(valorPorSemana)})</span>
                    </div>
                  )}
                </div>
                {semanasDescontadas > 0 && maxRetiroSeleccion > 0 && (
                  <div className={`rounded-lg px-3 py-2 text-xs sm:text-sm ${
                    totalDevolver <= maxRetiroSeleccion
                      ? "bg-wv-green/10 border border-wv-green/20"
                      : "bg-wv-red/10 border border-wv-red/20"
                  }`}>
                    {totalDevolver <= maxRetiroSeleccion ? (
                      <p>
                        <span className="font-semibold text-wv-green">Consistente</span>
                        <span className="text-muted-foreground">
                          {" "}— el monto a devolver ({formatMXN(totalDevolver)}) cabe dentro del máximo retirable de los periodos seleccionados ({formatMXN(maxRetiroSeleccion)})
                        </span>
                      </p>
                    ) : (
                      <p>
                        <span className="font-semibold text-wv-red">Inconsistente</span>
                        <span className="text-muted-foreground">
                          {" "}— el monto a devolver ({formatMXN(totalDevolver)}) excede el máximo retirable ({formatMXN(maxRetiroSeleccion)}). Verifica la selección de periodos.
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {retiros.some((r) => r.topeAplicado) && (
              <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                * Máx. retiro limitado al tope de 10× UMA mensual vigente en el año de la baja
              </p>
            )}
          </div>
        ) : semanasDescontadas > 0 ? (
          <p className="text-xs sm:text-sm text-muted-foreground">
            No se detectaron periodos de desempleo (&ge;46 días, post-1997) en el
            historial laboral, pero la constancia registra semanas descontadas.
          </p>
        ) : null}

        {/* Reference formulas */}
        <div className="border-t border-wv-border/50 pt-3 space-y-1.5">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Referencia — Art. 191 LSS
          </p>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground space-y-0.5">
            <p>Elegibilidad: 46+ días naturales sin empleo, mín. 5 años entre retiros</p>
            <p>Máx. retiro Modalidad A: 30 días × último SBC (tope: 10× UMA mensual)</p>
            <p>Máx. retiro Modalidad B: menor entre 90 días × SBC prom. 250 sem. y 11.5% del saldo RCV</p>
            <p>Semanas descontadas = monto retirado ÷ (saldo RCV ÷ semanas cotizadas) al momento del retiro</p>
            <p>Devolución: mismo monto nominal retirado, sin intereses</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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

        {/* Eligible periods table */}
        {retiros.length > 0 ? (
          <div className="space-y-2.5">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Periodos de desempleo elegibles — selecciona los retiros ejercidos
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
                      Días sin empleo
                    </th>
                    <th className="pb-2 pr-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                      Último SBC
                    </th>
                    <th className="pb-2 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                      Máx. retiro (Mod. A)
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

            {/* Selection summary */}
            {selected.size > 0 && (
              <div className="rounded-lg border border-wv-border bg-muted/40 p-3 space-y-2.5">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Resumen de selección
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <div>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Retiros seleccionados
                    </p>
                    <p className="text-sm sm:text-base font-bold font-mono mt-0.5">
                      {selected.size}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Máx. retirable (Mod. A)
                    </p>
                    <p className="text-sm sm:text-base font-bold font-mono mt-0.5">
                      {formatMXN(maxRetiroSeleccion)}
                    </p>
                  </div>
                  {semanasDescontadas > 0 && (
                    <div>
                      <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Semanas descontadas
                      </p>
                      <p className="text-sm sm:text-base font-bold font-mono mt-0.5 text-wv-red">
                        {semanasDescontadas}
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-wv-cyan/5 border border-wv-cyan/20 px-3 py-2">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Monto exacto a devolver:</span>{" "}
                    consultar con la AFORE. El reintegro es por el monto nominal
                    que se retiró en su momento (sin intereses). Solo la AFORE
                    tiene el registro histórico de los montos.
                  </p>
                </div>
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
        <div className="border-t border-wv-border/50 pt-3 space-y-2">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Referencia — Art. 191 y 198 LSS
          </p>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground space-y-1">
            <p><span className="font-medium text-foreground/70">Elegibilidad:</span> 46+ días naturales sin empleo, mín. 5 años entre retiros</p>
            <p><span className="font-medium text-foreground/70">Modalidad A:</span> 30 días × último SBC (tope: 10× UMA mensual)</p>
            <p><span className="font-medium text-foreground/70">Modalidad B:</span> menor entre 90 días × SBC prom. 250 sem. y 11.5% del saldo RCV</p>
            <p><span className="font-medium text-foreground/70">Semanas descontadas:</span> monto retirado ÷ (saldo RCV ÷ semanas cotizadas) al momento del retiro</p>
            <p><span className="font-medium text-foreground/70">Reintegro:</span> mismo monto nominal retirado, sin intereses. Parcial o total. Sin plazo límite.</p>
            <p><span className="font-medium text-foreground/70">Semanas recuperadas:</span> semanas descontadas × (monto reintegrado ÷ monto total retirado)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

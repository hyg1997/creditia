"use client";

import { useState, useMemo, useCallback } from "react";
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

interface RowData {
  semanas: number;
  monto: number;
}

function parseDDMMYYYY(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtDate(d: Date): string {
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

function addDays(dateStr: string, days: number): string {
  const d = parseDDMMYYYY(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return fmtDate(d);
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
  const [rowData, setRowData] = useState<Record<number, RowData>>({});

  const valorPorSemana =
    semanasReconocidas > 0 ? totalRCVBruto / semanasReconocidas : 0;

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

  const totales = useMemo(() => {
    let semanas = 0;
    let monto = 0;
    for (const idx of selected) {
      const data = rowData[idx];
      if (data) {
        semanas += data.semanas;
        monto += data.monto;
      }
    }
    return { semanas, monto };
  }, [selected, rowData]);

  const restantes = semanasDescontadas - totales.semanas;

  function toggleSelection(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
        setRowData((prev) => {
          const next = { ...prev };
          delete next[idx];
          return next;
        });
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  const handleSemanasChange = useCallback(
    (idx: number, value: string) => {
      const semanas = Math.max(0, parseInt(value) || 0);
      const monto = Math.round(semanas * valorPorSemana * 100) / 100;
      setRowData((prev) => ({ ...prev, [idx]: { semanas, monto } }));
    },
    [valorPorSemana]
  );

  const handleMontoChange = useCallback(
    (idx: number, value: string) => {
      const monto = Math.max(0, parseFloat(value) || 0);
      const semanas =
        valorPorSemana > 0 ? Math.round(monto / valorPorSemana) : 0;
      setRowData((prev) => ({ ...prev, [idx]: { semanas, monto } }));
    },
    [valorPorSemana]
  );

  if (retiros.length === 0 && semanasDescontadas === 0) return null;

  const totalRetiros = retiros.length;

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
                {" "}registradas en la constancia
              </span>
            </p>
          </div>
        )}

        {/* Eligible periods table */}
        {retiros.length > 0 ? (
          <div className="space-y-2.5">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Empleos en los que estuvo más de 45 días sin volverse a emplear
            </p>
            <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-wv-border text-left">
                    <th className="pb-2 pr-2 text-center w-8"></th>
                    <th className="pb-2 pr-2 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider text-center w-8">
                      #
                    </th>
                    <th className="pb-2 pr-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Último día trabajado
                    </th>
                    <th className="pb-2 pr-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Fecha 46 días
                    </th>
                    <th className="pb-2 pr-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Reingreso
                    </th>
                    <th className="pb-2 pr-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                      Último SBC
                    </th>
                    <th className="pb-2 pr-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                      Sem. desc.
                    </th>
                    <th className="pb-2 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                      Monto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {retiros.map((r, i) => {
                    const isSelected = selected.has(i);
                    const isDisabled = disabledIndices.has(i);
                    const isCurrent = isCurrentGap(r.fechaReingreso);
                    const data = rowData[i];
                    const num = totalRetiros - i;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-wv-border/50 transition-colors ${
                          isDisabled
                            ? "opacity-40 bg-wv-red/5"
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
                        <td className="py-2 pr-2 text-center text-muted-foreground font-mono">
                          {num}
                        </td>
                        <td className="py-2 pr-3 font-mono">{r.fechaBaja}</td>
                        <td className="py-2 pr-3 font-mono text-muted-foreground">
                          {addDays(r.fechaBaja, 46)}
                        </td>
                        <td className="py-2 pr-3 font-mono">
                          {isCurrent ? (
                            <span className="text-wv-cyan italic">Actual</span>
                          ) : (
                            r.fechaReingreso
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {formatMXN(r.salarioDiario)}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {isSelected ? (
                            <input
                              type="number"
                              min={0}
                              value={data?.semanas || ""}
                              onChange={(e) =>
                                handleSemanasChange(i, e.target.value)
                              }
                              placeholder="0"
                              className="w-16 rounded border border-wv-border bg-background px-1.5 py-0.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-wv-cyan focus:border-transparent"
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {isSelected ? (
                            <div className="relative">
                              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                $
                              </span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={data?.monto || ""}
                                onChange={(e) =>
                                  handleMontoChange(i, e.target.value)
                                }
                                placeholder="0"
                                className="w-24 rounded border border-wv-border bg-background pl-4 pr-1.5 py-0.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-wv-cyan focus:border-transparent"
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VPS reference */}
            {valorPorSemana > 0 && (
              <p className="text-[10px] sm:text-[11px] text-muted-foreground font-mono">
                Valor por semana estimado: {formatMXN(valorPorSemana)} (RCV
                bruto {formatMXN(totalRCVBruto)} ÷ {semanasReconocidas} sem.)
              </p>
            )}

            {/* Summary footer */}
            {selected.size > 0 && totales.semanas > 0 && (
              <div className="rounded-lg border border-wv-border bg-muted/40 p-3 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <div>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Sem. asignadas
                    </p>
                    <p className="text-sm sm:text-base font-bold font-mono mt-0.5">
                      {totales.semanas}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Constancia
                    </p>
                    <p className="text-sm sm:text-base font-bold font-mono mt-0.5">
                      {semanasDescontadas}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Restantes
                    </p>
                    <p
                      className={`text-sm sm:text-base font-bold font-mono mt-0.5 ${
                        restantes === 0
                          ? "text-wv-green"
                          : restantes > 0
                            ? "text-wv-red"
                            : "text-wv-cyan"
                      }`}
                    >
                      {restantes}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Total a devolver
                    </p>
                    <p className="text-sm sm:text-base font-bold font-mono mt-0.5 text-wv-red">
                      {formatMXN(totales.monto)}
                    </p>
                  </div>
                </div>

                {restantes === 0 && (
                  <div className="rounded-lg bg-wv-green/10 border border-wv-green/20 px-3 py-1.5">
                    <p className="text-xs sm:text-sm font-semibold text-wv-green">
                      Semanas descontadas cuadran con la constancia
                    </p>
                  </div>
                )}
                {restantes < 0 && (
                  <div className="rounded-lg bg-wv-cyan/10 border border-wv-cyan/20 px-3 py-1.5">
                    <p className="text-xs sm:text-sm text-wv-cyan">
                      Semanas asignadas exceden la constancia por{" "}
                      {Math.abs(restantes)} — verificar datos
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : semanasDescontadas > 0 ? (
          <p className="text-xs sm:text-sm text-muted-foreground">
            No se detectaron periodos de desempleo (&ge;46 días, post-1997) en
            el historial laboral, pero la constancia registra semanas
            descontadas.
          </p>
        ) : null}

        {/* Reference */}
        <div className="border-t border-wv-border/50 pt-3 space-y-2">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Referencia — Art. 191 y 198 LSS
          </p>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground space-y-1">
            <p>
              <span className="font-medium text-foreground/70">
                Elegibilidad:
              </span>{" "}
              46+ días sin empleo, mín. 5 años entre retiros
            </p>
            <p>
              <span className="font-medium text-foreground/70">Mod. A:</span>{" "}
              30 días × último SBC (tope: 10× UMA mensual)
            </p>
            <p>
              <span className="font-medium text-foreground/70">Mod. B:</span>{" "}
              menor entre 90 días × SBC prom. 250 sem. y 11.5% del saldo RCV
            </p>
            <p>
              <span className="font-medium text-foreground/70">
                Sem. desc.:
              </span>{" "}
              monto retirado ÷ (saldo RCV ÷ sem. cotizadas) al momento del
              retiro
            </p>
            <p>
              <span className="font-medium text-foreground/70">
                Reintegro:
              </span>{" "}
              mismo monto nominal, sin intereses. Parcial o total. Sin plazo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

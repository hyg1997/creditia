"use client";

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
  totalDevolver: number;
  semanasDescontadas: number;
}

export function RetirosDesempleo({
  retiros,
  totalDevolver,
  semanasDescontadas,
}: RetirosDesempleoProps) {
  if (retiros.length === 0 && semanasDescontadas === 0) return null;

  return (
    <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-3">
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
                {" "}
                por retiro(s) parcial(es) de desempleo
              </span>
            </p>
          </div>
        )}

        {retiros.length > 0 ? (
          <>
            <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-wv-border text-left">
                    <th className="pb-2 pr-3 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      #
                    </th>
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
                      SBC Diario
                    </th>
                    <th className="pb-2 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                      A Devolver
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {retiros.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-wv-border/50 hover:bg-wv-hover transition-colors"
                    >
                      <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-3 font-mono">{r.fechaBaja}</td>
                      <td className="py-2 pr-3 font-mono">{r.fechaReingreso}</td>
                      <td className="py-2 pr-3 text-right font-mono">
                        {r.diasDesempleo}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        {formatMXN(r.salarioDiario)}
                      </td>
                      <td className="py-2 text-right font-mono font-semibold">
                        {formatMXN(r.montoRetiro)}
                        {r.topeAplicado && (
                          <span className="text-[9px] text-wv-cyan ml-1" title="Tope 10× UMA mensual aplicado">
                            *
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-wv-border">
                    <td
                      colSpan={5}
                      className="py-2.5 pr-3 text-right font-semibold text-xs sm:text-sm"
                    >
                      Total a Devolver
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-sm sm:text-base text-wv-red">
                      {formatMXN(totalDevolver)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {retiros.some((r) => r.topeAplicado) && (
              <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                * Monto limitado al tope de 10× UMA mensual vigente en el año de la baja
              </p>
            )}

            <p className="text-[10px] sm:text-[11px] text-muted-foreground">
              Retiro parcial por desempleo (Art. 191 LSS): 30 días × último SBC.
              Requisito: 46+ días sin empleo, mín. 5 años entre retiros.
              Devolución al mismo monto nominal.
            </p>
          </>
        ) : (
          <p className="text-xs sm:text-sm text-muted-foreground">
            No se detectaron periodos de desempleo elegibles para retiro parcial
            en el historial laboral, pero la constancia registra semanas
            descontadas.
          </p>
        )}
      </div>
    </div>
  );
}

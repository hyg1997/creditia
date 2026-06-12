"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/lib/supabase";
import { formatMXN, formatInt } from "@/lib/formatters";

const DEFAULT_SEMANAS = [
  { semanas: 900, orden: 0 },
  { semanas: 870, orden: 1 },
  { semanas: 840, orden: 2 },
  { semanas: 810, orden: 3 },
  { semanas: 780, orden: 4 },
  { semanas: 750, orden: 5 },
];

const DEFAULT_TIERS = [1700, 1450, 1200, 1000, 0];

const DEFAULT_COSTO = [60000, 70000, 80000, 90000, 100000];

function NumericInput({
  label,
  value,
  onChange,
  prefix,
  className = "",
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
        <input
          type="text"
          inputMode="numeric"
          value={value ? formatInt(value) : ""}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "");
            onChange(raw ? parseInt(raw) : 0);
          }}
          placeholder="0"
          className={`w-full rounded-lg border border-wv-border bg-background ${prefix ? "pl-6" : "px-3"} pr-3 py-1.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-wv-cyan focus:border-transparent`}
        />
      </div>
    </div>
  );
}

function generateSemanasLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const age = 60.5 + i;
    if (i === 0) return `Hasta ${age} años`;
    if (i === count - 1) return `Más de ${age} años`;
    return `${age} — ${age + 1} años`;
  });
}

function tierLabel(tiers: number[], idx: number): string {
  const min = tiers[idx];
  if (idx === 0) return `${formatInt(min)}+`;
  const prevMin = tiers[idx - 1];
  if (min === 0) return `< ${formatInt(prevMin)}`;
  return `${formatInt(min)} — ${formatInt(prevMin - 1)}`;
}

type EditSemanas = { id?: number; semanas: number; orden: number };

export default function EditPage() {
  const [semanasRows, setSemanasRows] = useState<EditSemanas[]>([]);
  const [costoTiers, setCostoTiers] = useState<number[]>([]);
  // costoMatrix[edadIdx][tierIdx] = costo_anual
  const [costoMatrix, setCostoMatrix] = useState<number[][]>([]);
  const [activeEdadTab, setActiveEdadTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  function initDefaults() {
    setSemanasRows(DEFAULT_SEMANAS.map((s, i) => ({ ...s, id: i })));
    setCostoTiers([...DEFAULT_TIERS]);
    setCostoMatrix(DEFAULT_SEMANAS.map(() => [...DEFAULT_COSTO]));
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      if (!supabase) {
        setSupabaseConnected(false);
        initDefaults();
        return;
      }
      // TODO: load from supabase once schema supports matrix
      setSupabaseConnected(false);
      initDefaults();
    } catch {
      setSupabaseConnected(false);
      initDefaults();
    } finally {
      setLoading(false);
    }
  }

  const semanasLabels = generateSemanasLabels(semanasRows.length);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      if (!supabaseConnected || !supabase) {
        setStatus({ type: "error", message: "Supabase no está conectado. Los cambios solo se ven en la vista previa." });
        return;
      }
      setStatus({ type: "success", message: "Reglas guardadas correctamente." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al guardar";
      setStatus({ type: "error", message });
    } finally {
      setSaving(false);
    }
  }, [supabaseConnected]);

  const updateSemanasNum = (idx: number, value: number) => {
    setSemanasRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], semanas: value };
      return next;
    });
  };

  const addSemanasRow = () => {
    setSemanasRows((prev) => [...prev, { semanas: 0, orden: prev.length }]);
    setCostoMatrix((prev) => [...prev, prev.length > 0 ? [...prev[prev.length - 1]] : DEFAULT_COSTO.map(() => 0)]);
  };

  const removeSemanasRow = (idx: number) => {
    setSemanasRows((prev) => prev.filter((_, i) => i !== idx));
    setCostoMatrix((prev) => prev.filter((_, i) => i !== idx));
    if (activeEdadTab >= semanasRows.length - 1) {
      setActiveEdadTab(Math.max(0, semanasRows.length - 2));
    }
  };

  const addCostoTier = () => {
    setCostoTiers((prev) => [...prev, 0]);
    setCostoMatrix((prev) => prev.map((row) => [...row, 0]));
  };

  const removeCostoTier = (tierIdx: number) => {
    setCostoTiers((prev) => prev.filter((_, i) => i !== tierIdx));
    setCostoMatrix((prev) => prev.map((row) => row.filter((_, i) => i !== tierIdx)));
  };

  const updateCostoTier = (tierIdx: number, value: number) => {
    setCostoTiers((prev) => {
      const next = [...prev];
      next[tierIdx] = value;
      return next;
    });
  };

  const updateCostoCelda = (edadIdx: number, tierIdx: number, value: number) => {
    setCostoMatrix((prev) => {
      const next = prev.map((row) => [...row]);
      next[edadIdx][tierIdx] = value;
      return next;
    });
  };

  const copyToAll = () => {
    setCostoMatrix((prev) => {
      const source = prev[activeEdadTab];
      if (!source) return prev;
      return prev.map(() => [...source]);
    });
  };

  return (
    <main className="flex-1">
      <header className="bg-wv-surface/80 backdrop-blur-lg border-b border-wv-border text-foreground sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="h-8 w-8 rounded-lg bg-wv-cyan/10 flex items-center justify-center text-wv-cyan">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight">Creditia Edit</h1>
              <p className="text-[10px] sm:text-[11px] text-wv-label leading-tight">Reglas de Negocio</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            {!supabaseConnected && !loading && (
              <span className="text-[10px] sm:text-xs text-wv-red bg-wv-red/10 px-2 py-1 rounded-full">Sin conexion DB</span>
            )}
            {supabaseConnected && !loading && (
              <span className="text-[10px] sm:text-xs text-wv-green bg-wv-green/10 px-2 py-1 rounded-full">Conectado</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Cargando reglas...</p>
          </div>
        ) : (
          <>
            {status && (
              <div className={`rounded-lg px-4 py-3 text-sm font-medium ${status.type === "success" ? "bg-wv-green/10 text-wv-green border border-wv-green/20" : "bg-wv-red/10 text-wv-red border border-wv-red/20"}`}>
                {status.message}
              </div>
            )}

            {/* Semanas por Edad */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                  <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">Semanas por Edad</h2>
                </div>
                <Button
                  variant="ghost"
                  onClick={addSemanasRow}
                  className="text-xs bg-wv-cyan/10 text-wv-cyan hover:bg-wv-cyan/20 px-3 py-1 h-auto"
                >
                  + Agregar
                </Button>
              </div>

              <div className="space-y-2">
                {semanasRows.map((row, idx) => (
                  <div key={idx} className="bg-wv-surface rounded-xl border border-wv-border px-4 py-3 flex items-end gap-3">
                    <NumericInput
                      label="Semanas Min."
                      value={row.semanas}
                      onChange={(v) => updateSemanasNum(idx, v)}
                      className="w-32"
                    />
                    <div className="flex-1">
                      <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Rango de Edad</p>
                      <p className="px-3 py-1.5 text-xs sm:text-sm text-muted-foreground bg-muted/40 rounded-lg border border-wv-border/50">
                        {semanasLabels[idx]}
                      </p>
                    </div>
                    {semanasRows.length > 1 && (
                      <button
                        onClick={() => removeSemanasRow(idx)}
                        className="text-wv-red/60 hover:text-wv-red p-1.5 mb-0.5"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Costo AFORE por Edad */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                  <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">Costo AFORE por Edad</h2>
                </div>
                <Button
                  variant="ghost"
                  onClick={addCostoTier}
                  className="text-xs bg-wv-cyan/10 text-wv-cyan hover:bg-wv-cyan/20 px-3 py-1 h-auto"
                >
                  + Agregar tier
                </Button>
              </div>

              {/* Age range tabs */}
              <div className="flex gap-1 bg-wv-surface rounded-xl border border-wv-border p-1 mb-3 overflow-x-auto">
                {semanasRows.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveEdadTab(idx)}
                    className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
                      activeEdadTab === idx
                        ? "bg-wv-cyan/10 text-wv-cyan"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {semanasLabels[idx]}
                  </button>
                ))}
              </div>

              {/* Cost tiers for active age tab */}
              <div className="bg-wv-surface rounded-xl border border-wv-border overflow-hidden">
                <div className="px-4 py-3 border-b border-wv-border/50 flex items-center justify-between">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Costos para <span className="text-foreground font-medium">{semanasLabels[activeEdadTab]}</span>
                  </p>
                  <button
                    onClick={copyToAll}
                    className="text-[10px] sm:text-xs text-wv-cyan hover:text-wv-cyan/80 transition-colors font-medium cursor-pointer"
                  >
                    Aplicar a todos los rangos
                  </button>
                </div>

                <div className="divide-y divide-wv-border/50">
                  {costoTiers.map((tier, tierIdx) => (
                    <div key={tierIdx} className="px-4 py-2.5 flex items-center gap-3">
                      <NumericInput
                        label={tierIdx === 0 ? "Sem. Min." : undefined}
                        value={tier}
                        onChange={(v) => updateCostoTier(tierIdx, v)}
                        className="w-28"
                      />
                      <div className="flex-1 min-w-0">
                        {tierIdx === 0 && (
                          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Costo Anual</p>
                        )}
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={costoMatrix[activeEdadTab]?.[tierIdx] ? formatInt(costoMatrix[activeEdadTab][tierIdx]) : ""}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              updateCostoCelda(activeEdadTab, tierIdx, raw ? parseInt(raw) : 0);
                            }}
                            placeholder="0"
                            className="w-full rounded-lg border border-wv-border bg-background pl-6 pr-3 py-1.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-wv-cyan focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div className="w-24 text-right">
                        {tierIdx === 0 && (
                          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Etiqueta</p>
                        )}
                        <p className="text-[10px] sm:text-xs text-muted-foreground py-1.5">
                          {tierLabel(costoTiers, tierIdx)}
                        </p>
                      </div>
                      {costoTiers.length > 1 && (
                        <button
                          onClick={() => removeCostoTier(tierIdx)}
                          className="text-wv-red/60 hover:text-wv-red p-1"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Preview — Matrix */}
            <section>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-4 w-1 rounded-full bg-muted-foreground" />
                <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case text-muted-foreground">Vista Previa</h2>
              </div>

              {/* Semanas preview */}
              <div className="rounded-lg border border-wv-border overflow-hidden mb-3">
                <table className="w-full text-[10px] sm:text-xs">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Sem.</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Edad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semanasRows.map((r, i) => (
                      <tr key={i} className="border-t border-wv-border/50">
                        <td className="px-3 py-2 font-mono">{formatInt(r.semanas)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{semanasLabels[i]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cost matrix preview */}
              <div className="rounded-lg border border-wv-border overflow-x-auto">
                <table className="w-full text-[9px] sm:text-[10px]">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="px-2 sm:px-3 py-1.5 text-left font-medium text-muted-foreground sticky left-0 bg-muted/40">Semanas</th>
                      {semanasRows.map((_, eIdx) => (
                        <th key={eIdx} className="px-2 sm:px-3 py-1.5 text-right font-medium text-muted-foreground whitespace-nowrap">
                          {semanasLabels[eIdx]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {costoTiers.map((_, tIdx) => (
                      <tr key={tIdx} className="border-t border-wv-border/50">
                        <td className="px-2 sm:px-3 py-1.5 text-muted-foreground sticky left-0 bg-background whitespace-nowrap">
                          {tierLabel(costoTiers, tIdx)}
                        </td>
                        {semanasRows.map((__, eIdx) => {
                          const val = costoMatrix[eIdx]?.[tIdx] ?? 0;
                          return (
                            <td key={eIdx} className="px-2 sm:px-3 py-1.5 text-right font-mono">
                              {formatMXN(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Save button */}
            <div className="flex justify-end pt-2 pb-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-wv-cyan text-black hover:bg-wv-cyan/90 px-6 py-2 text-sm font-semibold"
              >
                {saving ? "Guardando..." : "Guardar Reglas"}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase, type ReglasSemanas, type ReglasCosto } from "@/lib/supabase";
import { formatMXN, formatInt } from "@/lib/formatters";

const DEFAULT_SEMANAS: Omit<ReglasSemanas, "id">[] = [
  { semanas: 900, label: "Hasta 60.5 años", orden: 0 },
  { semanas: 870, label: "60.5 — 61.5 años", orden: 1 },
  { semanas: 840, label: "61.5 — 62.5 años", orden: 2 },
  { semanas: 810, label: "62.5 — 63.5 años", orden: 3 },
  { semanas: 780, label: "63.5 — 64.5 años", orden: 4 },
  { semanas: 750, label: "Mas de 64.5 años", orden: 5 },
];

const DEFAULT_COSTOS: Omit<ReglasCosto, "id">[] = [
  { min_semanas: 1700, costo_anual: 60000, label: "1,700+", orden: 0 },
  { min_semanas: 1450, costo_anual: 70000, label: "1,450 — 1,699", orden: 1 },
  { min_semanas: 1200, costo_anual: 80000, label: "1,200 — 1,449", orden: 2 },
  { min_semanas: 1000, costo_anual: 90000, label: "1,000 — 1,199", orden: 3 },
  { min_semanas: 0, costo_anual: 100000, label: "< 1,000", orden: 4 },
];

function InputField({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-wv-border bg-background px-3 py-1.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-wv-cyan focus:border-transparent"
      />
    </div>
  );
}

type EditSemanas = { id?: number; semanas: number; label: string; orden: number };
type EditCosto = { id?: number; min_semanas: number; costo_anual: number; label: string; orden: number };

export default function EditPage() {
  const [semanasRows, setSemanasRows] = useState<EditSemanas[]>([]);
  const [costoRows, setCostoRows] = useState<EditCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      if (!supabase) {
        setSupabaseConnected(false);
        setSemanasRows(DEFAULT_SEMANAS.map((s, i) => ({ ...s, id: i })));
        setCostoRows(DEFAULT_COSTOS.map((c, i) => ({ ...c, id: i })));
        return;
      }

      const { data: semanas, error: semError } = await supabase
        .from("reglas_semanas")
        .select("*")
        .order("orden");

      const { data: costos, error: cosError } = await supabase
        .from("reglas_costo")
        .select("*")
        .order("orden");

      if (semError || cosError) {
        setSupabaseConnected(false);
        setSemanasRows(DEFAULT_SEMANAS.map((s, i) => ({ ...s, id: i })));
        setCostoRows(DEFAULT_COSTOS.map((c, i) => ({ ...c, id: i })));
      } else {
        setSupabaseConnected(true);
        setSemanasRows(semanas?.length ? semanas : DEFAULT_SEMANAS.map((s) => ({ ...s })));
        setCostoRows(costos?.length ? costos : DEFAULT_COSTOS.map((c) => ({ ...c })));
      }
    } catch {
      setSupabaseConnected(false);
      setSemanasRows(DEFAULT_SEMANAS.map((s, i) => ({ ...s, id: i })));
      setCostoRows(DEFAULT_COSTOS.map((c, i) => ({ ...c, id: i })));
    } finally {
      setLoading(false);
    }
  }

  const handleSave = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      if (!supabaseConnected || !supabase) {
        setStatus({ type: "error", message: "Supabase no esta conectado. Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY." });
        return;
      }

      await supabase.from("reglas_semanas").delete().neq("id", 0);
      const { error: semErr } = await supabase.from("reglas_semanas").insert(
        semanasRows.map(({ semanas, label, orden }) => ({ semanas, label, orden }))
      );
      if (semErr) throw semErr;

      await supabase.from("reglas_costo").delete().neq("id", 0);
      const { error: cosErr } = await supabase.from("reglas_costo").insert(
        costoRows.map(({ min_semanas, costo_anual, label, orden }) => ({ min_semanas, costo_anual, label, orden }))
      );
      if (cosErr) throw cosErr;

      setStatus({ type: "success", message: "Reglas guardadas correctamente." });
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al guardar";
      setStatus({ type: "error", message });
    } finally {
      setSaving(false);
    }
  }, [semanasRows, costoRows, supabaseConnected]);

  const updateSemanas = (idx: number, field: keyof EditSemanas, value: string) => {
    setSemanasRows((prev) => {
      const next = [...prev];
      if (field === "semanas" || field === "orden") {
        (next[idx] as Record<string, unknown>)[field] = parseInt(value) || 0;
      } else {
        (next[idx] as Record<string, unknown>)[field] = value;
      }
      return next;
    });
  };

  const updateCosto = (idx: number, field: keyof EditCosto, value: string) => {
    setCostoRows((prev) => {
      const next = [...prev];
      if (field === "min_semanas" || field === "costo_anual" || field === "orden") {
        (next[idx] as Record<string, unknown>)[field] = parseInt(value) || 0;
      } else {
        (next[idx] as Record<string, unknown>)[field] = value;
      }
      return next;
    });
  };

  const addSemanasRow = () => {
    setSemanasRows((prev) => [...prev, { semanas: 0, label: "", orden: prev.length }]);
  };

  const removeSemanasRow = (idx: number) => {
    setSemanasRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addCostoRow = () => {
    setCostoRows((prev) => [...prev, { min_semanas: 0, costo_anual: 0, label: "", orden: prev.length }]);
  };

  const removeCostoRow = (idx: number) => {
    setCostoRows((prev) => prev.filter((_, i) => i !== idx));
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
            {/* Status message */}
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
                    <InputField
                      label="Semanas Min."
                      value={row.semanas}
                      onChange={(v) => updateSemanas(idx, "semanas", v)}
                      type="number"
                      className="w-28"
                    />
                    <InputField
                      label="Rango de Edad"
                      value={row.label}
                      onChange={(v) => updateSemanas(idx, "label", v)}
                      className="flex-1"
                    />
                    <button
                      onClick={() => removeSemanasRow(idx)}
                      className="text-wv-red/60 hover:text-wv-red p-1.5 mb-0.5"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Costo AFORE */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                  <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">Costo AFORE por Semanas</h2>
                </div>
                <Button
                  variant="ghost"
                  onClick={addCostoRow}
                  className="text-xs bg-wv-cyan/10 text-wv-cyan hover:bg-wv-cyan/20 px-3 py-1 h-auto"
                >
                  + Agregar
                </Button>
              </div>

              <div className="space-y-2">
                {costoRows.map((row, idx) => (
                  <div key={idx} className="bg-wv-surface rounded-xl border border-wv-border px-4 py-3 flex items-end gap-3">
                    <InputField
                      label="Semanas Min."
                      value={row.min_semanas}
                      onChange={(v) => updateCosto(idx, "min_semanas", v)}
                      type="number"
                      className="w-28"
                    />
                    <InputField
                      label="Costo Anual"
                      value={row.costo_anual}
                      onChange={(v) => updateCosto(idx, "costo_anual", v)}
                      type="number"
                      className="w-32"
                    />
                    <InputField
                      label="Etiqueta"
                      value={row.label}
                      onChange={(v) => updateCosto(idx, "label", v)}
                      className="flex-1"
                    />
                    <button
                      onClick={() => removeCostoRow(idx)}
                      className="text-wv-red/60 hover:text-wv-red p-1.5 mb-0.5"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Preview */}
            <section>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-4 w-1 rounded-full bg-muted-foreground" />
                <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case text-muted-foreground">Vista Previa</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-wv-border overflow-hidden">
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
                          <td className="px-3 py-2 text-muted-foreground">{r.label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-wv-border overflow-hidden">
                  <table className="w-full text-[10px] sm:text-xs">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Semanas</th>
                        <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Costo/año</th>
                        <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Costo/dia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costoRows.map((rc, i) => (
                        <tr key={i} className="border-t border-wv-border/50">
                          <td className="px-3 py-2 text-muted-foreground">{rc.label}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatMXN(rc.costo_anual)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatMXN(Math.round(rc.costo_anual / 365))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

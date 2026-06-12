"use client";

import { useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PdfUpload } from "@/components/pdf-upload";
import { ResultsSummary } from "@/components/results-summary";
import { AforeBreakdown } from "@/components/afore-breakdown";
import { EmploymentTimeline } from "@/components/employment-timeline";
import { SalaryAverageBreakdown } from "@/components/salary-average-breakdown";
import { PrintButton } from "@/components/print-button";
import { RetirosDesempleo } from "@/components/retiros-desempleo";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatMXN, formatInt } from "@/lib/formatters";
import { calcEscenarios, type ScenarioOutput } from "@/lib/calculations/pension-scenarios";

function parseDDMMYYYY(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function calcSinTrabajar(records: { fechaBaja: string }[]) {
  if (records.length === 0) return null;
  const fechas = records.map((r) => parseDDMMYYYY(r.fechaBaja).getTime());
  const ultimaBaja = new Date(Math.max(...fechas));
  const hoy = new Date();
  const diffMs = hoy.getTime() - ultimaBaja.getTime();
  const dias = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const anos = Math.floor(dias / 365);
  const meses = Math.floor((dias % 365) / 30);
  const diasRestantes = dias - anos * 365 - meses * 30;
  return { dias, anos, meses, diasRestantes, ultimaBaja };
}

function formatDiasCompleto(totalDias: number): string {
  const anos = Math.floor(totalDias / 365);
  const meses = Math.floor((totalDias % 365) / 30);
  const dias = totalDias - anos * 365 - meses * 30;
  const parts: string[] = [];
  if (anos > 0) parts.push(`${anos}a`);
  if (meses > 0) parts.push(`${meses}m`);
  if (dias > 0 || parts.length === 0) parts.push(`${dias}d`);
  return parts.join(" ");
}

const COSTO_TIERS = [1700, 1450, 1200, 1000, 0];

function costoTierLabel(tierIdx: number): string {
  const min = COSTO_TIERS[tierIdx];
  if (tierIdx === 0) return `${formatInt(min)}+`;
  const prevMin = COSTO_TIERS[tierIdx - 1];
  if (min === 0) return `< ${formatInt(prevMin)}`;
  return `${formatInt(min)} — ${formatInt(prevMin - 1)}`;
}

// [edadIdx][tierIdx] = costo_anual — each age range can have different costs
const COSTO_POR_EDAD: number[][] = [
  [60000, 70000, 80000, 90000, 100000], // Hasta 60.5
  [60000, 70000, 80000, 90000, 100000], // 60.5 — 61.5
  [60000, 70000, 80000, 90000, 100000], // 61.5 — 62.5
  [60000, 70000, 80000, 90000, 100000], // 62.5 — 63.5
  [60000, 70000, 80000, 90000, 100000], // 63.5 — 64.5
  [60000, 70000, 80000, 90000, 100000], // Más de 64.5
];

function getCostoRango(semanas: number, edadRangoIdx: number): { costoAnual: number; rangoIndex: number } {
  const costos = COSTO_POR_EDAD[edadRangoIdx] ?? COSTO_POR_EDAD[0];
  for (let i = 0; i < COSTO_TIERS.length; i++) {
    if (semanas >= COSTO_TIERS[i]) {
      return { costoAnual: costos[i], rangoIndex: i };
    }
  }
  return { costoAnual: costos[costos.length - 1], rangoIndex: COSTO_TIERS.length - 1 };
}

const LIMITE_MOD10_DIAS = 4 * 365 + 11 * 30 + 22;
const LIMITE_MOD40_DIAS = 11 * 30 + 12;

const RANGOS_SEMANAS = [
  { semanas: 900, label: "Hasta 60.5 años" },
  { semanas: 870, label: "60.5 — 61.5 años" },
  { semanas: 840, label: "61.5 — 62.5 años" },
  { semanas: 810, label: "62.5 — 63.5 años" },
  { semanas: 780, label: "63.5 — 64.5 años" },
  { semanas: 750, label: "Más de 64.5 años" },
];

function getSemanasMinByEdad(fechaNac: Date | null): { minSemanas: number; rangoIndex: number } {
  if (!fechaNac) return { minSemanas: 900, rangoIndex: 0 };
  const hoy = new Date();
  const thresholds = [
    { anos: 64, meses: 6, idx: 5 },
    { anos: 63, meses: 6, idx: 4 },
    { anos: 62, meses: 6, idx: 3 },
    { anos: 61, meses: 6, idx: 2 },
    { anos: 60, meses: 6, idx: 1 },
  ];
  for (const t of thresholds) {
    const threshold = new Date(Date.UTC(
      fechaNac.getUTCFullYear() + t.anos,
      fechaNac.getUTCMonth() + t.meses,
      fechaNac.getUTCDate() + 1,
    ));
    if (hoy.getTime() >= threshold.getTime()) {
      return { minSemanas: RANGOS_SEMANAS[t.idx].semanas, rangoIndex: t.idx };
    }
  }
  return { minSemanas: 900, rangoIndex: 0 };
}

function calcEdadExacta(fechaNac: Date): { anos: number; meses: number; dias: number } {
  const hoy = new Date();
  let anos = hoy.getUTCFullYear() - fechaNac.getUTCFullYear();
  let meses = hoy.getUTCMonth() - fechaNac.getUTCMonth();
  let dias = hoy.getUTCDate() - fechaNac.getUTCDate();
  if (dias < 0) {
    meses--;
    dias += new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 0)).getUTCDate();
  }
  if (meses < 0) {
    anos--;
    meses += 12;
  }
  return { anos, meses, dias };
}

function calcEdadFromCURP(
  curp: string,
): { edad: number; fechaNacimiento: Date } | null {
  if (!curp || curp.length < 10) return null;
  const yy = parseInt(curp.substring(4, 6), 10);
  const mm = parseInt(curp.substring(6, 8), 10) - 1;
  const dd = parseInt(curp.substring(8, 10), 10);
  const year = yy <= 30 ? 2000 + yy : 1900 + yy;
  const fechaNacimiento = new Date(Date.UTC(year, mm, dd));
  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - year;
  const cumpleEsteAno = new Date(Date.UTC(hoy.getUTCFullYear(), mm, dd));
  if (hoy < cumpleEsteAno) edad--;
  return { edad, fechaNacimiento };
}

function detectModalidad(registroPatronal: string): "mod10" | "mod40" | null {
  const suffix = registroPatronal.slice(-2);
  if (suffix === "10") return "mod10";
  if (suffix === "33" || suffix === "40") return "mod40";
  return null;
}

function getUltimoRegistro(
  records: {
    registroPatronal: string;
    fechaAlta: string;
    fechaBaja: string;
    salarioBaseCotizacion: number;
  }[],
) {
  if (records.length === 0) return null;
  return records.reduce((latest, r) => {
    return parseDDMMYYYY(r.fechaBaja).getTime() >
      parseDDMMYYYY(latest.fechaBaja).getTime()
      ? r
      : latest;
  });
}

interface SemanasDetail {
  semanas: number;
  totalDias: number;
  windowStart: Date;
  windowEnd: Date;
  mod40Corte: Date | null;
  periodos: { inicio: Date; fin: Date; dias: number; semanas: number }[];
}

function calcSemanasEn5Anos(
  records: { fechaAlta: string; fechaBaja: string; registroPatronal: string }[],
  ultimaCotizacion: Date,
): SemanasDetail {
  const MS_DAY = 1000 * 60 * 60 * 24;
  const windowOriginal = new Date(
    Date.UTC(
      ultimaCotizacion.getUTCFullYear() - 5,
      ultimaCotizacion.getUTCMonth(),
      ultimaCotizacion.getUTCDate(),
    ),
  );
  let windowStart = windowOriginal;
  let mod40Corte: Date | null = null;

  for (const r of records) {
    const suffix = r.registroPatronal.slice(-2);
    if (suffix !== "33" && suffix !== "40") continue;
    const baja = parseDDMMYYYY(r.fechaBaja);
    if (baja.getTime() >= windowStart.getTime() && baja.getTime() <= ultimaCotizacion.getTime()) {
      if (baja.getTime() > windowStart.getTime()) {
        windowStart = baja;
        mod40Corte = baja;
      }
    }
  }

  const rawPeriods: { inicio: number; fin: number }[] = [];
  for (const r of records) {
    const alta = parseDDMMYYYY(r.fechaAlta);
    const baja = parseDDMMYYYY(r.fechaBaja);
    const start = Math.max(alta.getTime(), windowStart.getTime());
    const end = Math.min(baja.getTime(), ultimaCotizacion.getTime());
    if (start <= end) {
      rawPeriods.push({ inicio: start, fin: end });
    }
  }

  if (rawPeriods.length === 0) {
    return { semanas: 0, totalDias: 0, windowStart, windowEnd: ultimaCotizacion, mod40Corte, periodos: [] };
  }

  rawPeriods.sort((a, b) => a.inicio - b.inicio);
  const merged: { inicio: number; fin: number }[] = [];
  let cur = { ...rawPeriods[0] };
  for (let i = 1; i < rawPeriods.length; i++) {
    if (rawPeriods[i].inicio <= cur.fin + MS_DAY) {
      cur.fin = Math.max(cur.fin, rawPeriods[i].fin);
    } else {
      merged.push(cur);
      cur = { ...rawPeriods[i] };
    }
  }
  merged.push(cur);

  let totalDias = 0;
  const periodos = merged.map((p) => {
    const dias = Math.floor((p.fin - p.inicio) / MS_DAY) + 1;
    totalDias += dias;
    return { inicio: new Date(p.inicio), fin: new Date(p.fin), dias, semanas: Math.floor(dias / 7) };
  });

  return { semanas: Math.floor(totalDias / 7), totalDias, windowStart, windowEnd: ultimaCotizacion, mod40Corte, periodos };
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    date.getUTCDate(),
  ));
}

function diffMonths(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12
    + (to.getUTCMonth() - from.getUTCMonth());
}

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatMesAno(date: Date): string {
  return `${MESES_ES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function applyDay15Rule(referenceDate: Date): Date {
  const day = referenceDate.getUTCDate();
  if (day <= 15) {
    return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  }
  return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1));
}

interface MesPensionResult {
  mesPension: Date;
  razon: string;
  cumple60: boolean;
  pasaron6Meses: boolean;
  fecha60: Date | null;
  fecha6Meses: Date;
}

function calcMesPensionPronta(
  fechaNacimiento: Date,
  ultimaCotizacion: Date,
): MesPensionResult {
  const hoy = new Date();
  const fecha60 = new Date(Date.UTC(
    fechaNacimiento.getUTCFullYear() + 60,
    fechaNacimiento.getUTCMonth(),
    fechaNacimiento.getUTCDate(),
  ));
  const fecha6Meses = addMonths(ultimaCotizacion, 6);

  const cumple60 = hoy.getTime() >= fecha60.getTime();
  const pasaron6Meses = hoy.getTime() >= fecha6Meses.getTime();

  if (cumple60) {
    if (pasaron6Meses) {
      const mesPension = applyDay15Rule(hoy);
      return { mesPension, razon: "Ya cumple 60 y ya pasaron 6 meses de conservacion. Se aplica regla del dia 15 a hoy.", cumple60, pasaron6Meses, fecha60, fecha6Meses };
    } else {
      const mesPension = applyDay15Rule(fecha6Meses);
      return { mesPension, razon: "Ya cumple 60 pero NO han pasado 6 meses. Se aplica regla del dia 15 a la fecha en que se cumplen 6 meses.", cumple60, pasaron6Meses, fecha60, fecha6Meses };
    }
  } else {
    if (pasaron6Meses) {
      const mesPension = applyDay15Rule(fecha60);
      return { mesPension, razon: "NO cumple 60 pero ya pasaron 6 meses. Se aplica regla del dia 15 al dia que cumple 60.", cumple60, pasaron6Meses, fecha60, fecha6Meses };
    } else {
      const fechaLimite = fecha60.getTime() > fecha6Meses.getTime() ? fecha60 : fecha6Meses;
      const mesPension = applyDay15Rule(new Date(fechaLimite));
      return { mesPension, razon: "NO cumple 60 y NO han pasado 6 meses. Se toma la fecha mas tardia (60 años o 6 meses) y se aplica regla del dia 15.", cumple60, pasaron6Meses, fecha60, fecha6Meses };
    }
  }
}

interface SubcuentaTotal {
  aportaciones: number;
  rendimientos: number;
  total: number;
}

interface ApiRetiroParcial {
  fechaBaja: string;
  fechaReingreso: string;
  diasDesempleo: number;
  salarioDiario: number;
  montoRetiro: number;
  topeAplicado: boolean;
  umaDiario: number;
  topeMensual: number;
}

interface ApiResult {
  regimen: "ley73" | "ley97";
  header: {
    nombre: string;
    nss: string;
    curp: string;
    totalSemanasCotizadas: number;
    semanasReconocidas: number;
    semanasDescontadas: number;
    semanasReintegradas: number;
  };
  records: {
    patron: string;
    registroPatronal: string;
    entidadFederativa: string;
    fechaAlta: string;
    fechaBaja: string;
    salarioBaseCotizacion: number;
  }[];
  salaryAverage: {
    promedio: number;
    periods: {
      fechaAlta: string;
      fechaBaja: string;
      salarioDiario: number;
      dias: number;
      semanasTotales: number;
      semanasContadas: number;
      resultado: number;
    }[];
  };
  afore: {
    sar92: SubcuentaTotal;
    vivienda92: SubcuentaTotal;
    retiro: SubcuentaTotal;
    ceavTrabajador: SubcuentaTotal;
    ceavPatron: SubcuentaTotal;
    cuotaSocial: SubcuentaTotal;
    vivienda97: SubcuentaTotal;
    totalRCV: number;
    totalRCVBruto: number;
    totalSAR92: number;
    totalVivienda: number;
    saldoTotal: number;
  };
  retirosDesempleo: {
    retiros: ApiRetiroParcial[];
    totalDevolver: number;
  };
}

function StatusBadge({
  pass,
  labelPass = "Cumple",
  labelFail = "No cumple",
}: {
  pass: boolean;
  labelPass?: string;
  labelFail?: string;
}) {
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full ${
        pass ? "bg-wv-green/10 text-wv-green" : "bg-wv-red/10 text-wv-red"
      }`}
    >
      <svg
        className="w-2.5 h-2.5 sm:w-3 sm:h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pass ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </>
        )}
      </svg>
      {pass ? labelPass : labelFail}
    </span>
  );
}

function SubCheck({
  pass,
  label,
  value,
}: {
  pass: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`rounded-lg p-2 sm:p-2.5 border ${pass ? "bg-wv-green/5 border-wv-green/20" : "bg-wv-red/5 border-wv-red/20"}`}
    >
      <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p className="text-xs sm:text-sm font-semibold mt-0.5">
        {pass ? "Cumple" : "No cumple"} — {value}
      </p>
    </div>
  );
}

function DetailToggle({ label, children }: { label?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 pt-2 border-t border-wv-border/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        {label ?? "Ver cómo se calculó"}
      </button>
      {open && (
        <div className="mt-2 space-y-1 text-[9px] sm:text-[10px] text-muted-foreground font-mono leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

function StepRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className={`text-right ${highlight ? "text-wv-cyan font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

function PensionSteps({ result, label }: { result: import("@/lib/calculations/pension-scenarios").PensionCalcResult; label: string }) {
  const s = result.steps;
  if (!s.salarioPromedio) return null;
  return (
    <DetailToggle label={`Ver cálculo: ${label}`}>
      <p className="text-muted-foreground/70 mb-1 font-sans">Datos de entrada</p>
      <StepRow label="Salario promedio diario" value={formatMXN(s.salarioPromedio)} />
      <StepRow label="Semanas cotizadas" value={formatInt(s.totalSemanas)} />
      <StepRow label="Edad al retiro" value={`${s.edadRetiro} años`} />
      <StepRow label="UMA" value={formatMXN(s.uma)} />
      <StepRow label="SMG" value={formatMXN(s.smg)} />
      <div className="border-t border-wv-border/30 my-1" />
      <p className="text-muted-foreground/70 mb-1 font-sans">Cuantía</p>
      <StepRow label="Salario en UMAs" value={`${s.salarioEnUMAs.toFixed(4)}`} />
      <StepRow label="Cuantía básica (tabla)" value={`${(s.cuantiaBasica * 100).toFixed(2)}%`} />
      <StepRow label="Incremento anual (tabla)" value={`${(s.cuantiaIncremento * 100).toFixed(4)}%`} />
      <StepRow label="Años de incremento" value={`${s.incrementYears}`} />
      <StepRow label="Método Anterior (35%+1.25%)" value={formatMXN(s.totalAnterior / 12)} />
      <StepRow label="Método Reformado (tabla)" value={formatMXN(s.totalReformado / 12)} />
      <StepRow label={`Cuantía usada → ${s.metodoUsado}`} value={formatMXN(s.cuantiaAnual / 12)} highlight />
      <StepRow label="+ 11% decreto Fox" value={formatMXN(s.cuantiaAnualCon11 / 12)} />
      <div className="border-t border-wv-border/30 my-1" />
      <p className="text-muted-foreground/70 mb-1 font-sans">Cesantía y asignaciones</p>
      <StepRow label={`Factor cesantía (${s.edadRetiro} años)`} value={`${(s.cesantiaFactor * 100).toFixed(0)}%`} />
      <StepRow label="Pensión mensual cesantía" value={formatMXN(s.pensionMensualCesantia)} />
      <StepRow label="Esposa" value={`${(s.esposaPC * 100).toFixed(0)}%`} />
      <StepRow label="Hijos" value={`${(s.hijosPC * 100).toFixed(0)}%`} />
      <StepRow label="Ayuda asistencial" value={`${(s.ayudaPC * 100).toFixed(0)}%`} />
      <StepRow label="Con asignaciones" value={formatMXN(s.pensionConAsignaciones)} />
      <StepRow label="Tope mensual" value={formatMXN(s.topeMensual)} />
      {s.topeCase !== "00" && (
        <StepRow label={`Tope aplicado (CASO ${s.topeCase})`} value={s.topeCase === "01" ? "Pensión > tope" : "Asignaciones reducidas"} highlight />
      )}
      <div className="border-t border-wv-border/30 my-1" />
      <p className="text-muted-foreground/70 mb-1 font-sans">Resultado</p>
      <StepRow label="Pensión mínima" value={formatMXN(s.pensionMinima)} />
      {s.usaPensionMinima && <StepRow label="→ Se aplica pensión mínima" value="Sí" highlight />}
      <StepRow label="Pensión bruta" value={formatMXN(result.pensionBruta)} highlight />
      <StepRow label={`ISR (exención: ${formatMXN(s.isrExencion)})`} value={`-${formatMXN(result.isr)}`} />
      <StepRow label="Base gravable" value={formatMXN(s.isrBaseGravable)} />
      <StepRow label="Pensión neta" value={formatMXN(result.pensionNeta)} highlight />
    </DetailToggle>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-wv-surface rounded-xl border border-wv-border p-4">
      <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-lg sm:text-2xl font-bold font-mono mt-1 text-wv-cyan">{value}</p>
      {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

type Tab = "calculadora" | "asesoria";

export default function Home() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tieneCredito, setTieneCredito] = useState(false);
  const [montoCredito, setMontoCredito] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("calculadora");
  const [esposa, setEsposa] = useState(true);
  const [hijos, setHijos] = useState(0);

  const handleTextExtracted = useCallback(async (text: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const response = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Error al procesar el PDF");
        return;
      }
      setResult(data);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
    setTieneCredito(false);
    setMontoCredito(0);
    setActiveTab("calculadora");
    setEsposa(true);
    setHijos(0);
  }, []);

  const isLey73 = result?.regimen === "ley73";
  const edadInfo = result ? calcEdadFromCURP(result.header.curp) : null;
  const edad = edadInfo?.edad ?? 0;
  const edadExacta = edadInfo?.fechaNacimiento ? calcEdadExacta(edadInfo.fechaNacimiento) : null;
  const semanasTotales = result
    ? result.header.totalSemanasCotizadas + result.header.semanasReintegradas
    : 0;
  const { minSemanas: semanasMinimas, rangoIndex: semanasRangoIndex } = getSemanasMinByEdad(edadInfo?.fechaNacimiento ?? null);
  const cumpleSemanas = semanasTotales >= semanasMinimas;
  const viviendaBruta = result ? result.afore.totalVivienda : 0;
  const descuentoCredito = tieneCredito ? Math.min(montoCredito, viviendaBruta) : 0;
  const viviendaAjustada = viviendaBruta - descuentoCredito;
  const saldoAfore = result
    ? result.afore.totalSAR92 +
      result.afore.retiro.total +
      viviendaAjustada
    : 0;
  const sinTrabajar = result ? calcSinTrabajar(result.records) : null;
  const { costoAnual, rangoIndex: costoRangoIndex } = getCostoRango(semanasTotales, semanasRangoIndex);
  const costoDiario = costoAnual / 365;
  const montoRequerido = sinTrabajar
    ? Math.round(sinTrabajar.dias * costoDiario)
    : 0;
  const cumpleAfore = saldoAfore >= montoRequerido;
  const faltante = Math.max(0, montoRequerido - saldoAfore);

  const ultimoRegistro = result ? getUltimoRegistro(result.records) : null;
  const modalidad = ultimoRegistro
    ? detectModalidad(ultimoRegistro.registroPatronal)
    : null;
  const ultimaCotizacion = ultimoRegistro
    ? parseDDMMYYYY(ultimoRegistro.fechaBaja)
    : null;
  const diasSinCotizar = sinTrabajar ? sinTrabajar.dias : 0;

  const mod10CumpleTiempo = diasSinCotizar <= LIMITE_MOD10_DIAS;
  const semanasDetail =
    result && ultimaCotizacion
      ? calcSemanasEn5Anos(result.records, ultimaCotizacion)
      : null;
  const semanasEn5Anos = semanasDetail?.semanas ?? 0;
  const mod10CumpleSemanas = semanasEn5Anos >= 52;
  const mod10Cumple = mod10CumpleTiempo && mod10CumpleSemanas;

  const mod40Cumple = diasSinCotizar <= LIMITE_MOD40_DIAS;

  const mesesSinCotizar = sinTrabajar
    ? sinTrabajar.anos * 12 + sinTrabajar.meses
    : 0;

  const primeraCotizacion = result && result.records.length > 0
    ? result.records.reduce((earliest, r) => {
        const fecha = parseDDMMYYYY(r.fechaAlta);
        return fecha.getTime() < earliest.getTime() ? fecha : earliest;
      }, parseDDMMYYYY(result.records[0].fechaAlta))
    : null;

  const asesoriaAhoraCumpleEdad = edad >= 60;
  const asesoriaAhoraCumpleMeses = mesesSinCotizar > 12;
  const asesoriaAhoraCumple =
    asesoriaAhoraCumpleEdad && asesoriaAhoraCumpleMeses;

  const asesoriaFuturoCumpleEdad = edad >= 59;
  const asesoriaFuturoCumpleMeses = mesesSinCotizar > 5;
  const asesoriaFuturoCumple =
    asesoriaFuturoCumpleEdad && asesoriaFuturoCumpleMeses;

  const initials = result?.header.nombre
    ? result.header.nombre
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
    : "";

  const pensionResult = useMemo(() => {
    if (!edadInfo?.fechaNacimiento || !ultimaCotizacion) return null;
    return calcMesPensionPronta(edadInfo.fechaNacimiento, ultimaCotizacion);
  }, [edadInfo?.fechaNacimiento, ultimaCotizacion]);

  const mesesRetroactivo = useMemo(() => {
    if (!ultimaCotizacion || !pensionResult) return null;
    return diffMonths(ultimaCotizacion, pensionResult.mesPension);
  }, [ultimaCotizacion, pensionResult]);

  const escenarios: ScenarioOutput | null = useMemo(() => {
    if (!result || !edadInfo?.fechaNacimiento || !ultimaCotizacion || !pensionResult) return null;
    return calcEscenarios({
      salarioPromedio: result.salaryAverage.promedio,
      salaryPeriods: result.salaryAverage.periods,
      totalSemanas: result.header.totalSemanasCotizadas,
      semanasReintegradas: result.header.semanasReintegradas,
      fechaNacimiento: edadInfo.fechaNacimiento,
      ultimaCotizacion,
      mesPensionPronta: pensionResult.mesPension,
      esposa,
      hijos,
    });
  }, [result, edadInfo?.fechaNacimiento, ultimaCotizacion, pensionResult, esposa, hijos]);

  return (
    <main className="flex-1">
      <header className="bg-wv-surface/80 backdrop-blur-lg border-b border-wv-border text-foreground sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="h-8 w-8 rounded-lg bg-wv-cyan/10 flex items-center justify-center text-wv-cyan">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight">
                Creditia
              </h1>
              <p className="text-[10px] sm:text-[11px] text-wv-label leading-tight">
                Calculadora AFORE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 no-print">
            <ThemeToggle />
            {result && (
              <>
                <span className="hidden sm:inline-flex">
                  {isLey73 && <PrintButton />}
                </span>
                <Button
                  variant="ghost"
                  onClick={handleReset}
                  className="text-xs sm:text-sm bg-foreground/5 border border-foreground/10 text-foreground hover:bg-foreground/10 px-2.5 sm:px-3"
                >
                  <span className="sm:hidden">Nuevo</span>
                  <span className="hidden sm:inline">Nuevo cálculo</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {!result && (
          <div className="max-w-xl mx-auto space-y-5 sm:space-y-6">
            <div className="text-center pt-8 sm:pt-12 pb-2">
              <div className="inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-wv-cyan/10 text-wv-cyan mb-4 sm:mb-5">
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M12 12v6" />
                  <path d="m15 15-3-3-3 3" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
                Calcula tu Saldo AFORE
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto text-xs sm:text-sm leading-relaxed">
                Sube tu Constancia de Semanas Cotizadas del IMSS y obtén tu
                saldo AFORE estimado al instante
              </p>
            </div>

            <PdfUpload
              onTextExtracted={handleTextExtracted}
              isProcessing={isProcessing}
            />

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground pb-4">
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3 h-3 text-wv-green shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Procesamiento local — sin almacenamiento</span>
              </div>
              <span className="hidden sm:inline text-wv-border">|</span>
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3 h-3 text-wv-cyan shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>PDFs escaneados y digitales del IMSS</span>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
            {/* Person Info */}
            <div className="bg-wv-surface rounded-[16px] border border-wv-border shadow-sm dark:shadow-none px-4 sm:px-5 py-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="hidden sm:flex h-10 w-10 shrink-0 rounded-full bg-wv-cyan/10 items-center justify-center text-wv-cyan font-bold text-sm">
                  {initials}
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-x-6 gap-y-1.5 sm:gap-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground text-[10px] sm:text-xs uppercase sm:normal-case tracking-wider sm:tracking-normal">
                      Nombre{" "}
                    </span>
                    <span className="font-semibold">
                      {result.header.nombre}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] sm:text-xs uppercase sm:normal-case tracking-wider sm:tracking-normal">
                      NSS{" "}
                    </span>
                    <span className="font-mono text-xs sm:text-sm">
                      {result.header.nss}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] sm:text-xs uppercase sm:normal-case tracking-wider sm:tracking-normal">
                      CURP{" "}
                    </span>
                    <span className="font-mono text-xs sm:text-sm">
                      {result.header.curp}
                    </span>
                  </div>
                  {edadInfo && (
                    <div>
                      <span className="text-muted-foreground text-[10px] sm:text-xs uppercase sm:normal-case tracking-wider sm:tracking-normal">
                        Edad{" "}
                      </span>
                      <span className="font-semibold">
                        {edadInfo.edad} años
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            {isLey73 && (
              <div className="flex gap-1 bg-wv-surface rounded-xl border border-wv-border p-1 no-print">
                <button
                  onClick={() => setActiveTab("calculadora")}
                  className={`flex-1 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    activeTab === "calculadora"
                      ? "bg-wv-cyan/10 text-wv-cyan"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  Calculadora
                </button>
                <button
                  onClick={() => setActiveTab("asesoria")}
                  className={`flex-1 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    activeTab === "asesoria"
                      ? "bg-wv-cyan/10 text-wv-cyan"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  Asesoria
                </button>
              </div>
            )}

            {activeTab === "calculadora" && (<>
            {/* Verdict Banner */}
            {(() => {
              const razones: string[] = [];
              if (!isLey73) razones.push("Régimen Ley 97");
              if (!cumpleSemanas) razones.push(`Faltan ${formatInt(semanasMinimas - semanasTotales)} semanas`);
              if (!cumpleAfore) razones.push(`Faltante AFORE: ${formatMXN(faltante)}`);
              if (modalidad === "mod10" && !mod10Cumple) razones.push("No cumple Modalidad 10");
              if (modalidad === "mod40" && !mod40Cumple) razones.push("No cumple Modalidad 40");

              const cumpleModalidad = modalidad === "mod10" ? mod10Cumple : modalidad === "mod40" ? mod40Cumple : true;
              const pasaFiltros = isLey73 && cumpleSemanas && cumpleAfore && cumpleModalidad;
              const acreditaAhora = pasaFiltros && asesoriaAhoraCumple;
              const acreditaFuturo = pasaFiltros && asesoriaFuturoCumple;

              if (!isLey73) {
                return (
                  <div className="rounded-xl sm:rounded-[16px] border-2 border-wv-red/30 bg-gradient-to-r from-wv-red/10 to-wv-surface px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 h-10 w-10 rounded-full bg-wv-red/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-wv-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </div>
                      <div>
                        <p className="font-bold text-sm sm:text-lg text-wv-red">No aplica — Régimen Ley 97</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Solo se atienden clientes Ley 73 (alta antes del 1 julio 1997)</p>
                      </div>
                    </div>
                  </div>
                );
              }

              if (acreditaAhora) {
                return (
                  <div className="rounded-xl sm:rounded-[16px] border-2 border-wv-green/40 bg-gradient-to-r from-wv-green/10 to-wv-surface px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 h-10 w-10 rounded-full bg-wv-green/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-wv-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <div>
                        <p className="font-bold text-sm sm:text-lg text-wv-green">Acredita Financiamiento Ahora</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{edad} años, {formatInt(semanasTotales)} semanas, {mesesSinCotizar} meses sin cotizar</p>
                      </div>
                    </div>
                  </div>
                );
              }

              if (acreditaFuturo) {
                return (
                  <div className="rounded-xl sm:rounded-[16px] border-2 border-wv-cyan/40 bg-gradient-to-r from-wv-cyan/10 to-wv-surface px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 h-10 w-10 rounded-full bg-wv-cyan/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-wv-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      </div>
                      <div>
                        <p className="font-bold text-sm sm:text-lg text-wv-cyan">Acredita Financiamiento Futuro</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                          {edad} años, {formatInt(semanasTotales)} semanas
                          {!asesoriaAhoraCumple && (
                            <span> — No acredita Ahora: {!asesoriaAhoraCumpleEdad ? `necesita 60 años (tiene ${edad})` : `necesita +12 meses sin cotizar (tiene ${mesesSinCotizar})`}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="rounded-xl sm:rounded-[16px] border-2 border-wv-red/30 bg-gradient-to-r from-wv-red/10 to-wv-surface px-4 sm:px-6 py-3 sm:py-4">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 h-10 w-10 rounded-full bg-wv-red/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-wv-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </div>
                    <div>
                      <p className="font-bold text-sm sm:text-lg text-wv-red">No acredita financiamiento</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{razones.length > 0 ? razones.join(" · ") : `${edad} años, ${mesesSinCotizar} meses sin cotizar`}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Validations */}
            <section>
              <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                  Validaciones
                </h2>
              </div>

              <div className="space-y-2 sm:space-y-2.5">
                {/* Ley 73 */}
                <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                  <div className={`border-l-4 ${isLey73 ? "border-l-wv-green" : "border-l-wv-red"} px-3.5 sm:px-5 py-2.5 sm:py-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-xs sm:text-sm">Régimen Ley 73</p>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 leading-tight">
                          {isLey73
                            ? <>Primera alta antes del 1 julio 1997{primeraCotizacion && <> — {primeraCotizacion.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}</>}</>
                            : "Primera alta después del 1 de julio de 1997"}
                        </p>
                      </div>
                      <StatusBadge pass={isLey73} />
                    </div>
                  </div>
                </div>

                {/* Semanas Cotizadas — age-based ranges */}
                <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                  <div className={`border-l-4 ${cumpleSemanas ? "border-l-wv-green" : "border-l-wv-red"} px-3.5 sm:px-4 py-2.5 sm:py-3 space-y-2 sm:space-y-2.5`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-xs sm:text-sm">Semanas Cotizadas</p>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 leading-tight">
                          {formatInt(semanasTotales)} semanas — Mínimo requerido: {formatInt(semanasMinimas)}
                          {edadExacta && <> (edad: {edadExacta.anos}a {edadExacta.meses}m {edadExacta.dias}d)</>}
                        </p>
                      </div>
                      <StatusBadge pass={cumpleSemanas} />
                    </div>

                    <DetailToggle label="Ver tabla de semanas por edad y desglose">
                      <div className="rounded-lg border border-wv-border overflow-hidden font-sans">
                        <table className="w-full text-[10px] sm:text-xs">
                          <thead>
                            <tr className="bg-muted/40">
                              <th className="px-2.5 sm:px-3 py-1.5 text-left font-medium text-muted-foreground w-16">Sem.</th>
                              <th className="px-2.5 sm:px-3 py-1.5 text-left font-medium text-muted-foreground">Edad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {RANGOS_SEMANAS.map((r, i) => {
                              const isActive = i === semanasRangoIndex;
                              return (
                                <tr
                                  key={i}
                                  className={isActive
                                    ? "bg-wv-cyan/10 font-semibold"
                                    : "border-t border-wv-border/50"}
                                >
                                  <td className={`px-2.5 sm:px-3 py-2 sm:py-2.5 font-mono ${isActive ? "text-wv-cyan" : ""}`}>{formatInt(r.semanas)}</td>
                                  <td className={`px-2.5 sm:px-3 py-2 sm:py-2.5 ${isActive ? "text-wv-cyan" : "text-muted-foreground"}`}>{r.label}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-2 font-sans">
                        <div className="bg-muted/60 rounded-lg p-2">
                          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cotizadas</p>
                          <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5">{formatInt(result.header.totalSemanasCotizadas)}</p>
                        </div>
                        <div className="bg-muted/60 rounded-lg p-2">
                          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Descontadas</p>
                          <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5 text-wv-red">{formatInt(result.header.semanasDescontadas)}</p>
                        </div>
                        <div className="bg-muted/60 rounded-lg p-2">
                          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Reintegradas</p>
                          <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5 text-wv-green">{formatInt(result.header.semanasReintegradas)}</p>
                        </div>
                      </div>
                    </DetailToggle>
                  </div>
                </div>

                {/* Saldo AFORE */}
                <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                  <div
                    className={`border-l-4 ${cumpleAfore ? "border-l-wv-green" : "border-l-wv-red"} px-3.5 sm:px-4 py-2.5 sm:py-3 space-y-2 sm:space-y-2.5`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-xs sm:text-sm">
                          Saldo AFORE
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                          Costo: {formatMXN(costoAnual)}/año ({formatMXN(Math.round(costoDiario))}/día) — {formatInt(semanasTotales)} semanas
                        </p>
                      </div>
                      <StatusBadge pass={cumpleAfore} />
                    </div>

                    <DetailToggle label="Ver tabla de costos y cálculo del monto requerido">
                      <p className="text-muted-foreground/70 mb-1 font-sans">Rango de edad: {RANGOS_SEMANAS[semanasRangoIndex].label}</p>
                      <div className="rounded-lg border border-wv-border overflow-hidden font-sans">
                        <table className="w-full text-[10px] sm:text-xs">
                          <thead>
                            <tr className="bg-muted/40">
                              <th className="px-2.5 sm:px-3 py-1.5 text-left font-medium text-muted-foreground">Semanas</th>
                              <th className="px-2.5 sm:px-3 py-1.5 text-right font-medium text-muted-foreground">Costo/año</th>
                              <th className="px-2.5 sm:px-3 py-1.5 text-right font-medium text-muted-foreground">Costo/día</th>
                            </tr>
                          </thead>
                          <tbody>
                            {COSTO_TIERS.map((tier, i) => {
                              const costoVal = (COSTO_POR_EDAD[semanasRangoIndex] ?? COSTO_POR_EDAD[0])[i];
                              const isActive = i === costoRangoIndex;
                              return (
                                <tr
                                  key={i}
                                  className={isActive
                                    ? "bg-wv-cyan/10 font-semibold"
                                    : "border-t border-wv-border/50"}
                                >
                                  <td className={`px-2.5 sm:px-3 py-1 ${isActive ? "text-wv-cyan" : "text-muted-foreground"}`}>{costoTierLabel(i)}</td>
                                  <td className={`px-2.5 sm:px-3 py-1 text-right font-mono ${isActive ? "text-wv-cyan" : ""}`}>{formatMXN(costoVal)}</td>
                                  <td className={`px-2.5 sm:px-3 py-1 text-right font-mono ${isActive ? "text-wv-cyan" : ""}`}>{formatMXN(Math.round(costoVal / 365))}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-2 space-y-0.5">
                        <StepRow label="Semanas cotizadas" value={formatInt(semanasTotales)} />
                        <StepRow label={`Rango edad: ${RANGOS_SEMANAS[semanasRangoIndex].label}`} value={`Tier: ${costoTierLabel(costoRangoIndex)}`} />
                        <StepRow label="Costo anual (según rango × edad)" value={formatMXN(costoAnual)} />
                        <StepRow label="Costo diario (anual ÷ 365)" value={formatMXN(Math.round(costoDiario))} />
                        <StepRow label="Días sin trabajar" value={formatInt(sinTrabajar?.dias ?? 0)} />
                        <StepRow label={`Monto requerido (${formatInt(sinTrabajar?.dias ?? 0)}d × ${formatMXN(Math.round(costoDiario))}/d)`} value={formatMXN(montoRequerido)} highlight />
                        <StepRow label="Saldo AFORE disponible" value={formatMXN(saldoAfore)} />
                        {tieneCredito && descuentoCredito > 0 && (
                          <StepRow label="Descuento crédito INFONAVIT" value={`-${formatMXN(descuentoCredito)}`} />
                        )}
                        <StepRow label={cumpleAfore ? "Excedente" : "Faltante"} value={formatMXN(Math.abs(saldoAfore - montoRequerido))} highlight />
                      </div>
                    </DetailToggle>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                      <div className="bg-muted/60 rounded-lg p-2">
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Sin trabajar
                        </p>
                        <p className="text-xs sm:text-sm font-semibold mt-0.5">
                          {sinTrabajar && sinTrabajar.dias > 0 ? (
                            <>
                              {sinTrabajar.anos > 0 && `${sinTrabajar.anos}a `}
                              {sinTrabajar.meses > 0 &&
                                `${sinTrabajar.meses}m `}
                              {sinTrabajar.diasRestantes > 0 &&
                                `${sinTrabajar.diasRestantes}d`}
                              <span className="text-muted-foreground font-normal text-[10px] sm:text-xs">
                                {" "}
                                ({formatInt(sinTrabajar.dias)}d)
                              </span>
                            </>
                          ) : (
                            "Trabajando"
                          )}
                        </p>
                      </div>
                      <div className="bg-muted/60 rounded-lg p-2">
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Requerido
                        </p>
                        <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5">
                          {formatMXN(montoRequerido)}
                        </p>
                      </div>
                      <div className="bg-muted/60 rounded-lg p-2">
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Saldo actual
                        </p>
                        <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5">
                          {formatMXN(saldoAfore)}
                        </p>
                      </div>
                      {!cumpleAfore && (
                        <div className="bg-wv-red/10 rounded-lg p-2">
                          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            Faltante
                          </p>
                          <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5 text-wv-red">
                            {formatMXN(faltante)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modalidad (filtro) */}
                {(modalidad === "mod10" || modalidad === "mod40") && (
                  <div className="grid grid-cols-1">
                    {modalidad === "mod10" && (
                      <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                        <div
                          className={`border-l-4 ${mod10Cumple ? "border-l-wv-green" : "border-l-wv-red"} px-3.5 sm:px-4 py-2.5 sm:py-3 space-y-2`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-xs sm:text-sm">
                                Modalidad 10
                              </p>
                              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                                RP: {ultimoRegistro?.registroPatronal}
                              </p>
                            </div>
                            <StatusBadge pass={mod10Cumple} />
                          </div>
                          <div className="space-y-1.5">
                            <SubCheck
                              pass={mod10CumpleTiempo}
                              label="Conservación (máx. 4a 11m 22d)"
                              value={`${formatDiasCompleto(diasSinCotizar)} (${diasSinCotizar} días)`}
                            />
                            <SubCheck
                              pass={mod10CumpleSemanas}
                              label="Mín. 52 sem. cotizadas en 5 años"
                              value={`${semanasEn5Anos} semanas (${semanasDetail?.totalDias ?? 0} días)`}
                            />
                          </div>

                          {semanasDetail && (
                            <DetailToggle label="Ver periodos en ventana de 5 años">
                              <div className="space-y-2 font-sans">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] sm:text-[10px] text-muted-foreground">
                                  <span>
                                    Ventana: {semanasDetail.windowStart.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
                                    {" → "}
                                    {semanasDetail.windowEnd.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
                                  </span>
                                  {semanasDetail.mod40Corte && (
                                    <span className="text-amber-500">
                                      Mod 40 recortó ventana al {semanasDetail.mod40Corte.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
                                    </span>
                                  )}
                                </div>

                                {semanasDetail.periodos.length > 0 && (
                                  <div className="space-y-1">
                                    {semanasDetail.periodos.map((p, i) => {
                                      const pct = semanasDetail.totalDias > 0 ? (p.dias / semanasDetail.totalDias) * 100 : 0;
                                      return (
                                        <div key={i} className="space-y-0.5">
                                          <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
                                            <span className="text-muted-foreground">
                                              {p.inicio.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}
                                              {" → "}
                                              {p.fin.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}
                                            </span>
                                            <span className={`font-mono font-medium ${mod10CumpleSemanas ? "text-wv-green" : "text-foreground"}`}>
                                              {p.semanas} sem ({p.dias}d)
                                            </span>
                                          </div>
                                          <div className="h-1.5 rounded-full bg-wv-border/40 overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${mod10CumpleSemanas ? "bg-wv-green" : "bg-wv-red"}`}
                                              style={{ width: `${Math.max(pct, 2)}%` }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                    <div className="flex justify-between text-[9px] sm:text-[10px] font-mono pt-1 border-t border-wv-border/30">
                                      <span className="text-muted-foreground">Total</span>
                                      <span className={mod10CumpleSemanas ? "text-wv-green font-semibold" : "text-wv-red font-semibold"}>
                                        {semanasEn5Anos} sem ({semanasDetail.totalDias}d)
                                      </span>
                                    </div>
                                    {!mod10CumpleSemanas && (
                                      <p className="text-[9px] sm:text-[10px] text-wv-red mt-1">
                                        Faltan {52 - semanasEn5Anos} semanas para cumplir el mínimo de 52
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </DetailToggle>
                          )}
                        </div>
                      </div>
                    )}

                    {modalidad === "mod40" && (
                      <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                        <div
                          className={`border-l-4 ${mod40Cumple ? "border-l-wv-green" : "border-l-wv-red"} px-3.5 sm:px-4 py-2.5 sm:py-3 space-y-2`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-xs sm:text-sm">
                                Modalidad 40
                              </p>
                              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                                RP: {ultimoRegistro?.registroPatronal}
                              </p>
                            </div>
                            <StatusBadge pass={mod40Cumple} />
                          </div>
                          <SubCheck
                            pass={mod40Cumple}
                            label={`Máx. ${formatDiasCompleto(LIMITE_MOD40_DIAS)} sin cotizar`}
                            value={`${formatDiasCompleto(diasSinCotizar)} (${diasSinCotizar} días)`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Financiamiento — decisión clave para el asesor */}
                {edadInfo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                    <div
                      className={`rounded-xl sm:rounded-[16px] overflow-hidden border-2 ${asesoriaAhoraCumple ? "border-wv-green/40 bg-gradient-to-br from-wv-surface to-wv-green/5" : "border-wv-red/30 bg-gradient-to-br from-wv-surface to-wv-red/5"}`}
                    >
                      <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm sm:text-base">
                              Financiamiento Ahora
                            </p>
                            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                              Pensión inmediata
                            </p>
                          </div>
                          <StatusBadge
                            pass={asesoriaAhoraCumple}
                            labelPass="Acredita"
                            labelFail="No acredita"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <SubCheck
                            pass={asesoriaAhoraCumpleEdad}
                            label="Edad min. 60"
                            value={`${edad} años`}
                          />
                          <SubCheck
                            pass={asesoriaAhoraCumpleMeses}
                            label="> 12 meses sin cotizar"
                            value={sinTrabajar ? `${sinTrabajar.anos}a ${sinTrabajar.meses}m ${sinTrabajar.diasRestantes}d` : `${mesesSinCotizar} meses`}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      className={`rounded-xl sm:rounded-[16px] overflow-hidden border-2 ${asesoriaFuturoCumple ? "border-wv-green/40 bg-gradient-to-br from-wv-surface to-wv-green/5" : "border-wv-red/30 bg-gradient-to-br from-wv-surface to-wv-red/5"}`}
                    >
                      <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm sm:text-base">
                              Financiamiento Futuro
                            </p>
                            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                              Planeación a pensión
                            </p>
                          </div>
                          <StatusBadge
                            pass={asesoriaFuturoCumple}
                            labelPass="Acredita"
                            labelFail="No acredita"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <SubCheck
                            pass={asesoriaFuturoCumpleEdad}
                            label="Edad min. 59"
                            value={`${edad} años`}
                          />
                          <SubCheck
                            pass={asesoriaFuturoCumpleMeses}
                            label="> 5 meses sin cotizar"
                            value={sinTrabajar ? `${sinTrabajar.anos}a ${sinTrabajar.meses}m ${sinTrabajar.diasRestantes}d` : `${mesesSinCotizar} meses`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Retiros Parciales por Desempleo */}
            {isLey73 &&
              (result.retirosDesempleo.retiros.length > 0 ||
                result.header.semanasDescontadas > 0) && (
                <section>
                  <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                    <div className="h-4 w-1 rounded-full bg-wv-red" />
                    <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                      Retiros por Desempleo
                    </h2>
                  </div>
                  <RetirosDesempleo
                    retiros={result.retirosDesempleo.retiros}
                    semanasDescontadas={result.header.semanasDescontadas}
                    totalRCVBruto={result.afore.totalRCVBruto}
                    semanasReconocidas={result.header.semanasReconocidas}
                  />
                </section>
              )}

            {!isLey73 && (
              <div className="text-center py-2">
                <Button onClick={handleReset}>Subir otro PDF</Button>
              </div>
            )}

            {isLey73 && (
              <>
                {/* Crédito INFONAVIT */}
                <section>
                  <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                    <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                    <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                      Crédito INFONAVIT
                    </h2>
                  </div>
                  <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none px-4 sm:px-5 py-3 sm:py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={tieneCredito}
                          onClick={() => {
                            setTieneCredito(!tieneCredito);
                            if (tieneCredito) setMontoCredito(0);
                          }}
                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wv-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-background ${tieneCredito ? "bg-wv-cyan" : "bg-muted"}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${tieneCredito ? "translate-x-5" : "translate-x-0"}`}
                          />
                        </button>
                        <span className="text-xs sm:text-sm font-medium">
                          ¿Tiene crédito INFONAVIT?
                        </span>
                      </label>
                      {tieneCredito && (
                        <div className="flex items-center gap-2 flex-1 max-w-xs">
                          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Saldo del crédito:</span>
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={montoCredito ? formatInt(montoCredito) : ""}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, "");
                                setMontoCredito(raw ? Math.max(0, Number(raw)) : 0);
                              }}
                              placeholder="0"
                              className="w-full rounded-lg border border-wv-border bg-background pl-6 pr-3 py-1.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-wv-cyan focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {tieneCredito && descuentoCredito > 0 && (
                      <p className="text-[10px] sm:text-[11px] text-wv-red mt-2.5">
                        Se descuentan {formatMXN(descuentoCredito)} de vivienda ({formatMXN(viviendaBruta)} → {formatMXN(viviendaAjustada)})
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                    <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                    <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                      Resumen Financiero
                    </h2>
                  </div>
                  <ResultsSummary
                    saldoAforeRegresar={saldoAfore}
                    saldoSAR={
                      result.afore.totalSAR92 + result.afore.retiro.total
                    }
                    saldoRCV={result.afore.totalRCV}
                    saldoVivienda={viviendaAjustada}
                    promedioSalarial={result.salaryAverage.promedio}
                    totalSemanas={result.header.totalSemanasCotizadas}
                    totalRecords={
                      result.records.length || (saldoAfore > 0 ? -1 : 0)
                    }
                  />
                </section>

                <section>
                  <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                    <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                    <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                      Desglose de Cuentas
                    </h2>
                  </div>
                  <AforeBreakdown afore={result.afore} />
                </section>

                <section>
                  <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                    <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                    <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                      Promedio Salarial
                    </h2>
                  </div>
                  <SalaryAverageBreakdown
                    promedio={result.salaryAverage.promedio}
                    periods={result.salaryAverage.periods}
                  />
                </section>

                {result.records.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                      <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                      <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                        Historial Laboral
                      </h2>
                    </div>
                    <EmploymentTimeline records={result.records} />
                  </section>
                )}

                <footer className="text-[10px] sm:text-[11px] text-muted-foreground space-y-1 border-t border-wv-border pt-4 sm:pt-5 pb-4">
                  <p>
                    * Estimaciones basadas en fórmulas estándar del IMSS. El
                    saldo real puede variar por retiros, crédito Infonavit o
                    comisiones.
                  </p>
                  <p>
                    * Rendimientos: interés simple al 10.48% anual. La tasa real
                    varía según la AFORE.
                  </p>
                  <p>
                    * Cálculo informativo. Consulta tu estado de cuenta AFORE
                    para el saldo oficial.
                  </p>
                </footer>
              </>
            )}
            </>)}

            {activeTab === "asesoria" && isLey73 && (
              <>
                {/* Key Metrics */}
                <section>
                  <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                    <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                    <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">Metricas del Expediente</h2>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    <MetricCard
                      label="Semanas Cotizadas"
                      value={formatInt(semanasTotales)}
                      sub={`Cotizadas: ${formatInt(result.header.totalSemanasCotizadas)} | Desc: ${formatInt(result.header.semanasDescontadas)} | Reint: ${formatInt(result.header.semanasReintegradas)}`}
                    />
                    <MetricCard
                      label="Promedio Salarial"
                      value={formatMXN(result.salaryAverage.promedio)}
                      sub={`${formatMXN(result.salaryAverage.promedio * 30.4)} mensual`}
                    />
                    {edadExacta && (
                      <MetricCard
                        label="Edad Actual"
                        value={`${edadExacta.anos} años`}
                        sub={`${edadExacta.anos} años, ${edadExacta.meses} meses, ${edadExacta.dias} dias`}
                      />
                    )}
                  </div>
                </section>

                {/* Mes Pension Pronta */}
                {pensionResult && (
                  <section>
                    <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                      <div className="h-4 w-1 rounded-full bg-wv-green" />
                      <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">Mes Pension Pronta</h2>
                    </div>
                    <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                      <div className="border-l-4 border-l-wv-green px-4 sm:px-5 py-4 sm:py-5 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">Pension desde</p>
                            <p className="text-2xl sm:text-3xl font-bold font-mono text-wv-green mt-1">
                              {formatMesAno(pensionResult.mesPension)}
                            </p>
                          </div>
                          {mesesRetroactivo !== null && mesesRetroactivo > 0 && (
                            <div className="text-right">
                              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">Meses en retroactivo</p>
                              <p className="text-2xl sm:text-3xl font-bold font-mono text-wv-cyan mt-1">
                                {mesesRetroactivo}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className={`rounded-lg p-2.5 border ${pensionResult.cumple60 ? "bg-wv-green/5 border-wv-green/20" : "bg-wv-red/5 border-wv-red/20"}`}>
                            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cumple 60 años</p>
                            <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${pensionResult.cumple60 ? "text-wv-green" : "text-wv-red"}`}>
                              {pensionResult.cumple60 ? "Si" : "No"}
                              {!pensionResult.cumple60 && pensionResult.fecha60 && (
                                <span className="text-muted-foreground font-normal text-[10px]"> — cumple el {pensionResult.fecha60.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}</span>
                              )}
                            </p>
                          </div>
                          <div className={`rounded-lg p-2.5 border ${pensionResult.pasaron6Meses ? "bg-wv-green/5 border-wv-green/20" : "bg-wv-red/5 border-wv-red/20"}`}>
                            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">6 meses conservacion</p>
                            <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${pensionResult.pasaron6Meses ? "text-wv-green" : "text-wv-red"}`}>
                              {pensionResult.pasaron6Meses ? "Si" : "No"}
                              {!pensionResult.pasaron6Meses && (
                                <span className="text-muted-foreground font-normal text-[10px]"> — {pensionResult.fecha6Meses.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}</span>
                              )}
                            </p>
                          </div>
                          <div className="rounded-lg p-2.5 border border-wv-border bg-muted/30">
                            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Ultima cotizacion</p>
                            <p className="text-xs sm:text-sm font-semibold mt-0.5">
                              {ultimaCotizacion?.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
                            </p>
                          </div>
                          <div className="rounded-lg p-2.5 border border-wv-border bg-muted/30">
                            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Regla dia 15</p>
                            <p className="text-xs sm:text-sm font-semibold mt-0.5 text-muted-foreground">
                              {pensionResult.razon.includes("hoy") ? "Aplicada a hoy" : "Aplicada a fecha futura"}
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground italic">
                          {pensionResult.razon}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Pension Scenarios */}
                {escenarios && (
                  <section>
                    <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                      <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                      <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">Escenarios de Pension</h2>
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">Mod 40 Retroactivo</span>
                    </div>
                    <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                      <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-4">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                          <label className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={esposa}
                              onChange={(e) => setEsposa(e.target.checked)}
                              className="rounded border-wv-border"
                            />
                            Esposa/concubina
                          </label>
                          <label className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                            Hijos
                            <select
                              value={hijos}
                              onChange={(e) => setHijos(Number(e.target.value))}
                              className="rounded border border-wv-border bg-background px-1.5 py-0.5 text-[10px] sm:text-xs font-mono"
                            >
                              {[0, 1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </label>
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                            SBC Mod 40: {formatMXN(escenarios.mod40Salary)} diario (25 UMA)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="rounded-xl border-2 border-wv-border bg-muted/20 p-4">
                            <div className="text-center">
                              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pension Actual</p>
                              <p className="text-xl sm:text-2xl font-bold font-mono mt-1">{formatMXN(escenarios.pensionActual.pensionNeta)}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">mensual neta</p>
                            </div>
                            <PensionSteps result={escenarios.pensionActual} label="Actual" />
                          </div>
                          <div className="rounded-xl border-2 border-wv-green/40 bg-wv-green/5 p-4">
                            <div className="text-center">
                              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pension Pronta</p>
                              {pensionResult && (
                                <p className="text-[9px] sm:text-[10px] text-wv-green/70 font-medium">{formatMesAno(pensionResult.mesPension)}</p>
                              )}
                              <p className="text-xl sm:text-2xl font-bold font-mono mt-1 text-wv-green">{formatMXN(escenarios.pensionPronta.pensionNeta)}</p>
                              <p className="text-xs sm:text-sm font-semibold text-wv-green mt-1">+{formatMXN(escenarios.incremento1)}</p>
                              <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">
                                Prom: {formatMXN(escenarios.promedioE1)} · {Math.round(escenarios.mod40WeeksE1)} sem M40
                              </p>
                            </div>
                            <PensionSteps result={escenarios.pensionPronta} label="Pronta" />
                          </div>
                          <div className="rounded-xl border-2 border-wv-cyan/40 bg-wv-cyan/5 p-4">
                            <div className="text-center">
                              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pension +6 Meses</p>
                              {pensionResult && (
                                <p className="text-[9px] sm:text-[10px] text-wv-cyan/70 font-medium">{formatMesAno(addMonths(pensionResult.mesPension, 6))}</p>
                              )}
                              <p className="text-xl sm:text-2xl font-bold font-mono mt-1 text-wv-cyan">{formatMXN(escenarios.pension6Meses.pensionNeta)}</p>
                              <p className="text-xs sm:text-sm font-semibold text-wv-cyan mt-1">+{formatMXN(escenarios.incremento2)}</p>
                              <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">
                                Prom: {formatMXN(escenarios.promedioE2)} · {Math.round(escenarios.mod40WeeksE2)} sem M40
                              </p>
                            </div>
                            <PensionSteps result={escenarios.pension6Meses} label="+6 Meses" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

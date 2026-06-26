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
import { calcEscenarios, getPensionMinima, type ScenarioOutput } from "@/lib/calculations/pension-scenarios";

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

interface RightsEvent {
  type: "lost" | "recovered" | "not_recovered";
  gapStart: Date;
  gapEnd: Date;
  gapDays: number;
  conservationDays: number;
  accumulatedWeeks: number;
  weeksNeeded?: number;
  weeksWorked?: number;
}

interface RightsAnalysis {
  perdioDerechos: boolean;
  events: RightsEvent[];
  weeksNeededToRecover: number;
  lastLossDate: Date | null;
}

function analyzeRightsHistory(
  records: { fechaAlta: string; fechaBaja: string }[],
): RightsAnalysis {
  const empty: RightsAnalysis = { perdioDerechos: false, events: [], weeksNeededToRecover: 0, lastLossDate: null };
  if (records.length === 0) return empty;

  const MS_DAY = 1000 * 60 * 60 * 24;

  const sorted = [...records]
    .map(r => ({ alta: parseDDMMYYYY(r.fechaAlta), baja: parseDDMMYYYY(r.fechaBaja) }))
    .sort((a, b) => a.alta.getTime() - b.alta.getTime());

  const merged: { alta: Date; baja: Date }[] = [];
  let cur = { alta: sorted[0].alta, baja: sorted[0].baja };
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.alta.getTime() <= cur.baja.getTime() + MS_DAY) {
      if (next.baja.getTime() > cur.baja.getTime()) cur.baja = next.baja;
    } else {
      merged.push({ ...cur });
      cur = { alta: next.alta, baja: next.baja };
    }
  }
  merged.push({ ...cur });

  let accDays = 0;
  let hasRights = true;
  let lossDate: Date | null = null;
  const events: RightsEvent[] = [];

  for (let i = 0; i < merged.length; i++) {
    const period = merged[i];
    const periodDays = Math.floor((period.baja.getTime() - period.alta.getTime()) / MS_DAY) + 1;

    if (!hasRights && lossDate) {
      const daysSinceLoss = Math.floor((period.alta.getTime() - lossDate.getTime()) / MS_DAY);
      const yearsSinceLoss = daysSinceLoss / 365;
      const weeksNeeded = yearsSinceLoss <= 3 ? 0 : yearsSinceLoss <= 5 ? 26 : 52;
      const weeksWorked = Math.floor(periodDays / 7);

      if (weeksNeeded === 0 || weeksWorked >= weeksNeeded) {
        hasRights = true;
        events.push({
          type: "recovered", gapStart: merged[i - 1]?.baja ?? period.alta, gapEnd: period.alta,
          gapDays: daysSinceLoss, conservationDays: 0, accumulatedWeeks: Math.floor(accDays / 7),
          weeksNeeded, weeksWorked,
        });
        lossDate = null;
      } else {
        events.push({
          type: "not_recovered", gapStart: merged[i - 1]?.baja ?? period.alta, gapEnd: period.alta,
          gapDays: daysSinceLoss, conservationDays: 0, accumulatedWeeks: Math.floor(accDays / 7),
          weeksNeeded, weeksWorked,
        });
      }
    }

    accDays += periodDays;

    if (i < merged.length - 1) {
      const nextPeriod = merged[i + 1];
      const gapDays = Math.floor((nextPeriod.alta.getTime() - period.baja.getTime()) / MS_DAY);
      const accWeeks = Math.floor(accDays / 7);
      const conservationWeeks = Math.max(52, Math.floor(accWeeks * 0.25));
      const conservationDaysCap = conservationWeeks * 7;

      if (hasRights && gapDays > conservationDaysCap) {
        hasRights = false;
        const expirationMs = period.baja.getTime() + conservationDaysCap * MS_DAY;
        lossDate = new Date(expirationMs);
        events.push({
          type: "lost", gapStart: period.baja, gapEnd: nextPeriod.alta,
          gapDays, conservationDays: conservationDaysCap, accumulatedWeeks: accWeeks,
        });
      }
    } else if (hasRights) {
      const today = new Date();
      const gapDays = Math.floor((today.getTime() - period.baja.getTime()) / MS_DAY);
      const accWeeks = Math.floor(accDays / 7);
      const conservationWeeks = Math.max(52, Math.floor(accWeeks * 0.25));
      const conservationDaysCap = conservationWeeks * 7;

      if (gapDays > conservationDaysCap) {
        hasRights = false;
        const expirationMs = period.baja.getTime() + conservationDaysCap * MS_DAY;
        lossDate = new Date(expirationMs);
        events.push({
          type: "lost", gapStart: period.baja, gapEnd: today,
          gapDays, conservationDays: conservationDaysCap, accumulatedWeeks: accWeeks,
        });
      }
    }
  }

  let weeksNeededToRecover = 0;
  if (!hasRights && lossDate) {
    const today = new Date();
    const daysSinceLoss = Math.floor((today.getTime() - lossDate.getTime()) / MS_DAY);
    const yearsSinceLoss = daysSinceLoss / 365;
    weeksNeededToRecover = yearsSinceLoss <= 3 ? 0 : yearsSinceLoss <= 5 ? 26 : 52;
  }

  return { perdioDerechos: !hasRights, events, weeksNeededToRecover, lastLossDate: lossDate };
}

interface RangoEdad {
  semanas: number;
  edadMinima: number;
}

const DEFAULT_RANGOS: RangoEdad[] = [
  { semanas: 900, edadMinima: 0 },
  { semanas: 870, edadMinima: 60.5 },
  { semanas: 840, edadMinima: 61.5 },
  { semanas: 810, edadMinima: 62.5 },
  { semanas: 780, edadMinima: 63.5 },
  { semanas: 750, edadMinima: 64.5 },
];

const DEFAULT_COSTO_TIERS = [1700, 1450, 1200, 1000, 0];
const DEFAULT_COSTO_MATRIX: number[][] = DEFAULT_RANGOS.map(() => [60000, 70000, 80000, 90000, 100000]);

function makeTierLabel(tiers: number[], tierIdx: number): string {
  const min = tiers[tierIdx];
  if (tierIdx === 0) return `${formatInt(min)}+`;
  const prevMin = tiers[tierIdx - 1];
  if (min === 0) return `< ${formatInt(prevMin)}`;
  return `${formatInt(min)} — ${formatInt(prevMin - 1)}`;
}

function findCostoRango(semanas: number, edadRangoIdx: number, tiers: number[], matrix: number[][]): { costoAnual: number; rangoIndex: number } {
  const costos = matrix[edadRangoIdx] ?? matrix[0];
  for (let i = 0; i < tiers.length; i++) {
    if (semanas >= tiers[i]) {
      return { costoAnual: costos[i], rangoIndex: i };
    }
  }
  return { costoAnual: costos[costos.length - 1], rangoIndex: tiers.length - 1 };
}

const LIMITE_MOD10_DIAS_DEFAULT = 4 * 365 + 11 * 30 + 22;
const LIMITE_MOD40_DIAS_DEFAULT = 11 * 30 + 12;

interface RuleConfig { enabled: boolean; value: number }
interface RulesState {
  ahoraEdad: RuleConfig; ahoraMeses: RuleConfig;
  futuroEdad: RuleConfig; futuroMeses: RuleConfig;
  recupEdad: RuleConfig; recupSemMin: RuleConfig; recupAfore: RuleConfig;
  actMinEdad: RuleConfig; actMinEdadMeses: RuleConfig; actMinSemanas: RuleConfig; actMinSinCotizar: RuleConfig;
  comp500Edad: RuleConfig; comp500SemMin: RuleConfig; comp500SemMax: RuleConfig; comp500Afore: RuleConfig;
  mod40Dias: RuleConfig; mod10Dias: RuleConfig;
}
const DEFAULT_RULES: RulesState = {
  ahoraEdad: { enabled: true, value: 60 },
  ahoraMeses: { enabled: true, value: 12 },
  futuroEdad: { enabled: true, value: 59 },
  futuroMeses: { enabled: true, value: 5 },
  recupEdad: { enabled: true, value: 59 },
  recupSemMin: { enabled: true, value: 430 },
  recupAfore: { enabled: true, value: 40000 },
  actMinEdad: { enabled: true, value: 59 },
  actMinEdadMeses: { enabled: true, value: 8 },
  actMinSemanas: { enabled: true, value: 470 },
  actMinSinCotizar: { enabled: true, value: 730 },
  comp500Edad: { enabled: true, value: 59 },
  comp500SemMin: { enabled: true, value: 440 },
  comp500SemMax: { enabled: true, value: 490 },
  comp500Afore: { enabled: true, value: 40000 },
  mod40Dias: { enabled: true, value: LIMITE_MOD40_DIAS_DEFAULT },
  mod10Dias: { enabled: true, value: LIMITE_MOD10_DIAS_DEFAULT },
};

function RuleInput({ label, rule, ruleKey, onChange }: {
  label: string; rule: RuleConfig; ruleKey: string;
  onChange: (key: string, field: "enabled" | "value", val: boolean | number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input type="checkbox" checked={rule.enabled}
        onChange={(e) => onChange(ruleKey, "enabled", e.target.checked)}
        className="h-3.5 w-3.5 rounded border-wv-border accent-wv-cyan" />
      <span className={`text-[10px] sm:text-xs ${rule.enabled ? "text-foreground" : "text-muted-foreground line-through"} min-w-[100px]`}>{label}</span>
      <input type="text" inputMode="numeric"
        value={rule.value ? formatInt(rule.value) : ""}
        onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ""); onChange(ruleKey, "value", raw ? parseInt(raw) : 0); }}
        disabled={!rule.enabled}
        className="w-20 rounded-lg border border-wv-border bg-background px-2 py-1 text-[10px] sm:text-xs font-mono focus:outline-none focus:ring-1 focus:ring-wv-cyan disabled:opacity-40" />
    </div>
  );
}

function rangoEdadLabel(rangos: RangoEdad[], idx: number): string {
  if (rangos.length <= 1) return "Todas las edades";
  if (idx === 0) return `Hasta ${rangos[1].edadMinima} años`;
  if (idx === rangos.length - 1) return `Más de ${rangos[idx].edadMinima} años`;
  return `${rangos[idx].edadMinima} — ${rangos[idx + 1].edadMinima} años`;
}

function findSemanasMinByEdad(fechaNac: Date | null, rangos: RangoEdad[]): { minSemanas: number; rangoIndex: number } {
  if (!fechaNac || rangos.length === 0) return { minSemanas: rangos[0]?.semanas ?? 900, rangoIndex: 0 };
  const hoy = new Date();
  for (let i = rangos.length - 1; i > 0; i--) {
    const edadMin = rangos[i].edadMinima;
    const years = Math.floor(edadMin);
    const months = Math.round((edadMin - years) * 12);
    const threshold = new Date(Date.UTC(
      fechaNac.getUTCFullYear() + years,
      fechaNac.getUTCMonth() + months,
      fechaNac.getUTCDate() + 1,
    ));
    if (hoy.getTime() >= threshold.getTime()) {
      return { minSemanas: rangos[i].semanas, rangoIndex: i };
    }
  }
  return { minSemanas: rangos[0].semanas, rangoIndex: 0 };
}

function NumericInput({
  value,
  onChange,
  prefix,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
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
  );
}

function DecimalInput({
  value,
  onChange,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value || ""}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, "");
        onChange(raw ? parseFloat(raw) || 0 : 0);
      }}
      placeholder="0"
      className={`w-full rounded-lg border border-wv-border bg-background px-3 py-1.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-wv-cyan focus:border-transparent ${className}`}
    />
  );
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
      return { mesPension, razon: "Ya cumple 60 y ya pasaron 6 meses de conservación. Se aplica regla del día 15 a hoy.", cumple60, pasaron6Meses, fecha60, fecha6Meses };
    } else {
      const mesPension = applyDay15Rule(fecha6Meses);
      return { mesPension, razon: "Ya cumple 60 pero NO han pasado 6 meses. Se aplica regla del día 15 a la fecha en que se cumplen 6 meses.", cumple60, pasaron6Meses, fecha60, fecha6Meses };
    }
  } else {
    if (pasaron6Meses) {
      const mesPension = applyDay15Rule(fecha60);
      return { mesPension, razon: "NO cumple 60 pero ya pasaron 6 meses. Se aplica regla del día 15 al día que cumple 60.", cumple60, pasaron6Meses, fecha60, fecha6Meses };
    } else {
      const fechaLimite = fecha60.getTime() > fecha6Meses.getTime() ? fecha60 : fecha6Meses;
      const mesPension = applyDay15Rule(new Date(fechaLimite));
      return { mesPension, razon: "NO cumple 60 y NO han pasado 6 meses. Se toma la fecha más tardía (60 años o 6 meses) y se aplica regla del día 15.", cumple60, pasaron6Meses, fecha60, fecha6Meses };
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
  labelPass = "Acredita",
  labelFail = "No acredita",
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
    <div className="flex items-center gap-1.5 text-xs sm:text-sm">
      <span className={`uppercase text-[9px] sm:text-[10px] tracking-wider font-medium ${pass ? "text-muted-foreground" : "text-wv-red"}`}>
        {label}
      </span>
      <span className={`font-mono font-bold underline decoration-1 underline-offset-2 ${pass ? "text-foreground" : "text-wv-red"}`}>
        {value}
      </span>
    </div>
  );
}

function ToggleSection({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-3.5 sm:px-4 py-2 sm:py-2.5">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2 cursor-pointer hover:opacity-80 transition-opacity">
        <div className="flex-1 text-left">{header}</div>
        <svg className={`w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0 ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

function DetailToggle({ label, children, defaultOpen = false, section = false }: { label?: string; children: React.ReactNode; defaultOpen?: boolean; section?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (section) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-semibold hover:bg-wv-border/20 transition-colors cursor-pointer"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          {label}
        </button>
        {open && (
          <div className="pb-3 sm:pb-4">
            {children}
          </div>
        )}
      </div>
    );
  }
  const arrowOnly = label === "";
  return (
    <div className={arrowOnly ? "" : "mt-2 pt-2 border-t border-wv-border/50"}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-medium ${arrowOnly ? "ml-auto text-xs p-1" : "text-[10px] sm:text-xs"}`}
      >
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        {!arrowOnly && (label !== undefined ? label : "Ver cómo se calculó")}
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

export default function Home() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tieneCredito, setTieneCredito] = useState(false);
  const [montoCredito, setMontoCredito] = useState(0);
  const [esposa, setEsposa] = useState(true);
  const [hijos, setHijos] = useState(0);
  const [rangosEdad, setRangosEdad] = useState<RangoEdad[]>(DEFAULT_RANGOS.map(r => ({ ...r })));
  const [costoTiers, setCostoTiers] = useState<number[]>([...DEFAULT_COSTO_TIERS]);
  const [costoMatrix, setCostoMatrix] = useState<number[][]>(DEFAULT_COSTO_MATRIX.map(r => [...r]));
  const [showConfig, setShowConfig] = useState(false);
  const [activeEdadTab, setActiveEdadTab] = useState(0);

  // Calificación — formulario interactivo
  const [calPensionado, setCalPensionado] = useState<"no" | "temporal" | "definitivo" | null>(null);
  const [calNecesidad, setCalNecesidad] = useState<"si" | "no" | null>(null);
  const [calSimulacion, setCalSimulacion] = useState<"no" | "si_timbrados" | "si_no_timbrados" | null>(null);
  const [calDemandas, setCalDemandas] = useState<"no" | "conciliacion" | "avanzada" | null>(null);
  const [calReintegroManual, setCalReintegroManual] = useState<number | null>(null);

  // AFORE manual override
  const [tieneEstadoCuentaAfore, setTieneEstadoCuentaAfore] = useState(false);
  const [saldoAforeManual, setSaldoAforeManual] = useState(0);

  // Registro manual
  const [modoManual, setModoManual] = useState(false);
  const [manualInicioMes, setManualInicioMes] = useState(0);
  const [manualInicioAnio, setManualInicioAnio] = useState(1995);
  const [manualFechaNacDia, setManualFechaNacDia] = useState(1);
  const [manualFechaNacMes, setManualFechaNacMes] = useState(1);
  const [manualFechaNacAnio, setManualFechaNacAnio] = useState(1965);
  const [manualUltimaCotMes, setManualUltimaCotMes] = useState(1);
  const [manualUltimaCotAnio, setManualUltimaCotAnio] = useState(2020);
  const [manualSemanas, setManualSemanas] = useState(0);
  const [manualPromedio, setManualPromedio] = useState(0);

  // Reglas configurables
  const [rules, setRules] = useState<RulesState>({ ...DEFAULT_RULES });
  const updateRule = useCallback((key: string, field: "enabled" | "value", val: boolean | number) => {
    setRules(prev => {
      const current = prev[key as keyof RulesState];
      return { ...prev, [key]: { ...current, [field]: val } };
    });
  }, []);

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
    setEsposa(true);
    setHijos(0);
    setCalPensionado(null);
    setCalNecesidad(null);
    setCalSimulacion(null);
    setCalDemandas(null);
    setCalReintegroManual(null);
    setTieneEstadoCuentaAfore(false);
    setSaldoAforeManual(0);
    setModoManual(false);
  }, []);

  const isLey73 = result?.regimen === "ley73";
  const edadInfo = result ? calcEdadFromCURP(result.header.curp) : null;
  const edad = edadInfo?.edad ?? 0;
  const edadExacta = edadInfo?.fechaNacimiento ? calcEdadExacta(edadInfo.fechaNacimiento) : null;
  const semanasTotales = result
    ? result.header.totalSemanasCotizadas + result.header.semanasReintegradas
    : 0;
  const { minSemanas: semanasMinimas, rangoIndex: semanasRangoIndex } = findSemanasMinByEdad(edadInfo?.fechaNacimiento ?? null, rangosEdad);
  const cumpleSemanas = semanasTotales >= semanasMinimas;
  const viviendaBruta = result ? result.afore.totalVivienda : 0;
  const descuentoCredito = tieneCredito ? Math.min(montoCredito, viviendaBruta) : 0;
  const viviendaAjustada = viviendaBruta - descuentoCredito;
  const saldoAforeCalculado = result
    ? result.afore.totalSAR92 +
      result.afore.retiro.total +
      viviendaAjustada
    : 0;
  const saldoAfore = tieneEstadoCuentaAfore && saldoAforeManual > 0 ? saldoAforeManual : saldoAforeCalculado;
  const sinTrabajar = result ? calcSinTrabajar(result.records) : null;
  const { costoAnual, rangoIndex: costoRangoIndex } = findCostoRango(semanasTotales, semanasRangoIndex, costoTiers, costoMatrix);
  const costoDiario = costoAnual / 365;
  const montoRequerido = sinTrabajar
    ? Math.round(sinTrabajar.dias * costoDiario)
    : 0;
  const cumpleAfore = saldoAfore >= montoRequerido;

  const ultimoRegistro = result ? getUltimoRegistro(result.records) : null;
  const modalidad = ultimoRegistro
    ? detectModalidad(ultimoRegistro.registroPatronal)
    : null;
  const ultimaCotizacion = ultimoRegistro
    ? parseDDMMYYYY(ultimoRegistro.fechaBaja)
    : null;
  const diasSinCotizar = sinTrabajar ? sinTrabajar.dias : 0;

  const LIMITE_MOD10_DIAS = rules.mod10Dias.value;
  const LIMITE_MOD40_DIAS = rules.mod40Dias.value;
  const mod10CumpleTiempo = !rules.mod10Dias.enabled || diasSinCotizar <= LIMITE_MOD10_DIAS;
  const semanasDetail =
    result && ultimaCotizacion
      ? calcSemanasEn5Anos(result.records, ultimaCotizacion)
      : null;
  const semanasEn5Anos = semanasDetail?.semanas ?? 0;
  const mod10CumpleSemanas = modoManual || semanasEn5Anos >= 52;
  const mod10Cumple = mod10CumpleTiempo && mod10CumpleSemanas;

  const mod40Cumple = !rules.mod40Dias.enabled || diasSinCotizar <= LIMITE_MOD40_DIAS;

  const mesesSinCotizar = sinTrabajar
    ? sinTrabajar.anos * 12 + sinTrabajar.meses
    : 0;

  const primeraCotizacion = result && result.records.length > 0
    ? result.records.reduce((earliest, r) => {
        const fecha = parseDDMMYYYY(r.fechaAlta);
        return fecha.getTime() < earliest.getTime() ? fecha : earliest;
      }, parseDDMMYYYY(result.records[0].fechaAlta))
    : null;

  const asesoriaAhoraCumpleEdad = !rules.ahoraEdad.enabled || edad >= rules.ahoraEdad.value;
  const asesoriaAhoraCumpleMeses = !rules.ahoraMeses.enabled || mesesSinCotizar > rules.ahoraMeses.value;
  const asesoriaAhoraCumple =
    asesoriaAhoraCumpleEdad && asesoriaAhoraCumpleMeses;

  const asesoriaFuturoCumpleEdad = !rules.futuroEdad.enabled || edad >= rules.futuroEdad.value;
  const asesoriaFuturoCumpleMeses = !rules.futuroMeses.enabled || mesesSinCotizar > rules.futuroMeses.value;
  const asesoriaFuturoCumple =
    asesoriaFuturoCumpleEdad && asesoriaFuturoCumpleMeses;

  // Art. 150: Conservación de derechos = 25% de semanas cotizadas (mín 52 sem = 1 año)
  const semanasConservacion = Math.max(52, Math.floor(semanasTotales * 0.25));
  const diasConservacion = semanasConservacion * 7;
  const perdioDerechosSimple = diasSinCotizar > diasConservacion;

  // Rastreabilidad histórica de derechos — analiza gaps y recuperaciones en toda la vida laboral
  const rightsHistory = useMemo(() => {
    if (!result) return null;
    return analyzeRightsHistory(result.records);
  }, [result]);
  const perdioDerechos = rightsHistory?.perdioDerechos ?? perdioDerechosSimple;

  // Art. 151: Recuperación — semanas nuevas requeridas según tiempo desde pérdida
  const semanasNuevasRequeridas = rightsHistory?.weeksNeededToRecover ?? (
    perdioDerechosSimple ? ((() => { const d = Math.max(0, diasSinCotizar - diasConservacion) / 365; return d <= 3 ? 0 : d <= 5 ? 26 : 52; })()) : 0
  );
  const diasDesdePerdida = rightsHistory?.lastLossDate
    ? Math.floor((Date.now() - rightsHistory.lastLossDate.getTime()) / (1000 * 60 * 60 * 24))
    : Math.max(0, diasSinCotizar - diasConservacion);
  const anosDesdePerdida = diasDesdePerdida / 365;

  // Filtros de negocio para financiamiento de recuperación
  const recupCumpleEdad = !rules.recupEdad.enabled || edad >= rules.recupEdad.value;
  const recupCumpleSemanas = !rules.recupSemMin.enabled || semanasTotales >= rules.recupSemMin.value;
  const recupCumpleAfore = modoManual || !rules.recupAfore.enabled || saldoAfore >= rules.recupAfore.value;
  const recupAcredita = perdioDerechos && recupCumpleEdad && recupCumpleSemanas && recupCumpleAfore;

  // Actualización de Pensión Mínima — 4ta opción de financiamiento
  const edadEnMeses = edadExacta ? edadExacta.anos * 12 + edadExacta.meses : 0;
  const actMinCumpleEdad = !rules.actMinEdad.enabled || edadEnMeses >= rules.actMinEdad.value * 12 + rules.actMinEdadMeses.value;
  const actMinCumpleSemanas = !rules.actMinSemanas.enabled || semanasTotales >= rules.actMinSemanas.value;
  const actMinCumpleSinCotizar = !rules.actMinSinCotizar.enabled || diasSinCotizar >= rules.actMinSinCotizar.value;
  const pensionMinimaVigente = getPensionMinima();

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

  const actMinCumplePension = modoManual ? true : (escenarios ? escenarios.pensionActual.pensionBruta < pensionMinimaVigente : false);

  // Completar 500 Semanas — criterios individuales
  const comp500CumpleEdad = !rules.comp500Edad.enabled || edad >= rules.comp500Edad.value;
  const comp500CumpleSemanas = !rules.comp500SemMin.enabled || semanasTotales >= rules.comp500SemMin.value;
  const comp500CumpleMax = !rules.comp500SemMax.enabled || semanasTotales <= rules.comp500SemMax.value;
  const comp500CumpleAfore = modoManual || !rules.comp500Afore.enabled || saldoAfore >= rules.comp500Afore.value;

  // Cascada de calificación: si alguna descalifica, las siguientes no califican
  const calDescalificado = calPensionado === "definitivo"
    || calNecesidad === "no"
    || calSimulacion === "si_no_timbrados"
    || calDemandas === "avanzada";

  // Reintegro efectivo para cálculos — se suma al AFORE solo para Ahora/Futuro
  const montoReintegroEfectivo = calReintegroManual ?? (result?.retirosDesempleo?.totalDevolver ?? 0);
  const saldoAforeConReintegro = saldoAfore + montoReintegroEfectivo;
  const cumpleAforeConReintegro = modoManual || saldoAforeConReintegro >= montoRequerido;

  // Vigencia de derechos Mod 40 y pensión
  const vigenciaMod40 = ultimaCotizacion
    ? new Date(ultimaCotizacion.getTime() + (modalidad === "mod40" ? LIMITE_MOD40_DIAS : LIMITE_MOD10_DIAS) * 86400000)
    : null;
  const vigenciaMod40Activa = vigenciaMod40 ? vigenciaMod40.getTime() > Date.now() : false;

  const vigenciaPension = ultimaCotizacion
    ? new Date(ultimaCotizacion.getTime() + diasConservacion * 86400000)
    : null;
  const vigenciaPensionActiva = vigenciaPension ? vigenciaPension.getTime() > Date.now() : false;

  const cumpleModalidad = modalidad === "mod10" ? mod10Cumple : modalidad === "mod40" ? mod40Cumple : true;
  const pasaFiltrosBase = isLey73 && cumpleSemanas && cumpleModalidad && !calDescalificado;
  const acreditaAhora = pasaFiltrosBase && cumpleAforeConReintegro && asesoriaAhoraCumple && !perdioDerechos;
  const acreditaFuturo = pasaFiltrosBase && cumpleAforeConReintegro && asesoriaFuturoCumple && !perdioDerechos;
  const acreditaRecuperacion = isLey73 && !calDescalificado && !acreditaAhora && !acreditaFuturo && recupAcredita;
  const actMinAcredita = isLey73 && !calDescalificado && !acreditaAhora && !acreditaFuturo && !acreditaRecuperacion
    && actMinCumpleEdad && actMinCumpleSemanas && actMinCumpleSinCotizar && actMinCumplePension;
  const comp500Acredita = isLey73 && !calDescalificado && !acreditaAhora && !acreditaFuturo && !acreditaRecuperacion && !actMinAcredita
    && comp500CumpleEdad && comp500CumpleSemanas && comp500CumpleMax && comp500CumpleAfore;

  const calificacionLabel = !result ? null
    : calDescalificado ? (calPensionado === "definitivo" ? "Pensionado definitivo" : calNecesidad === "no" ? "No necesita financiamiento" : calSimulacion === "si_no_timbrados" ? "Simulación no timbrada" : calDemandas === "avanzada" ? "Demanda avanzada" : "Descalificado")
    : !isLey73 ? "Régimen Ley 97"
    : acreditaAhora ? "Acredita Financiamiento Ahora"
    : acreditaFuturo ? "Acredita Financiamiento Futuro"
    : acreditaRecuperacion ? "Acredita Recuperación de Derechos"
    : actMinAcredita ? "Acredita Actualización Pensión Mínima"
    : comp500Acredita ? "Califica Completar 500 Semanas"
    : "No califica para financiamientos";
  const calificacionPositiva = acreditaAhora || acreditaFuturo || acreditaRecuperacion || actMinAcredita || comp500Acredita;

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
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${showConfig ? "bg-wv-cyan/20 text-wv-cyan" : "bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"}`}
              title="Configuración"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
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

      {showConfig && (
        <div className="border-b border-wv-border bg-wv-surface/50 no-print">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">Configuración de Reglas</h2>
              </div>
              <button onClick={() => setShowConfig(false)} className="text-muted-foreground hover:text-foreground p-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Rangos de Edad y Costos — unified */}
            <div>
              {/* Tabs + add/remove */}
              <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                {rangosEdad.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveEdadTab(idx)}
                    className={`shrink-0 px-2 sm:px-2.5 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-medium transition-colors border ${
                      activeEdadTab === idx
                        ? "bg-wv-cyan/10 text-wv-cyan border-wv-cyan/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent"
                    }`}
                  >
                    {rangoEdadLabel(rangosEdad, idx)}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const lastEdad = rangosEdad.length > 0 ? rangosEdad[rangosEdad.length - 1].edadMinima + 1 : 60.5;
                    setRangosEdad(prev => [...prev, { semanas: Math.max(0, (prev[prev.length - 1]?.semanas ?? 750) - 30), edadMinima: lastEdad }]);
                    setCostoMatrix(prev => [...prev, prev.length > 0 ? [...prev[prev.length - 1]] : costoTiers.map(() => 0)]);
                    setActiveEdadTab(rangosEdad.length);
                  }}
                  className="shrink-0 px-2 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-medium text-wv-cyan hover:bg-wv-cyan/10 border border-dashed border-wv-cyan/30 transition-colors"
                >
                  + Rango
                </button>
              </div>

              {/* Active range config */}
              <div className="bg-background rounded-lg border border-wv-border/50 overflow-hidden">
                {/* Range header: edad + semanas + delete */}
                <div className="px-3 py-2.5 border-b border-wv-border/30 flex items-center gap-2 sm:gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground shrink-0">Edad min:</p>
                    <div className="w-16">
                      {activeEdadTab === 0 ? (
                        <p className="text-[10px] sm:text-xs text-muted-foreground py-1.5 text-center">—</p>
                      ) : (
                        <DecimalInput
                          value={rangosEdad[activeEdadTab]?.edadMinima ?? 0}
                          onChange={(v) => setRangosEdad(prev => { const n = [...prev]; n[activeEdadTab] = { ...n[activeEdadTab], edadMinima: v }; return n; })}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground shrink-0">Sem. min:</p>
                    <div className="w-20">
                      <NumericInput
                        value={rangosEdad[activeEdadTab]?.semanas ?? 0}
                        onChange={(v) => setRangosEdad(prev => { const n = [...prev]; n[activeEdadTab] = { ...n[activeEdadTab], semanas: v }; return n; })}
                      />
                    </div>
                  </div>
                  <div className="flex-1" />
                  <button
                    onClick={() => setCostoMatrix(prev => { const src = prev[activeEdadTab]; if (!src) return prev; return prev.map(() => [...src]); })}
                    className="text-[9px] sm:text-[10px] text-wv-cyan hover:text-wv-cyan/80 font-medium shrink-0"
                  >
                    Aplicar costos a todos
                  </button>
                  {rangosEdad.length > 1 && (
                    <button
                      onClick={() => {
                        setRangosEdad(prev => prev.filter((_, i) => i !== activeEdadTab));
                        setCostoMatrix(prev => prev.filter((_, i) => i !== activeEdadTab));
                        setActiveEdadTab(Math.max(0, activeEdadTab - 1));
                      }}
                      className="text-wv-red/50 hover:text-wv-red p-0.5 shrink-0"
                      title="Eliminar rango"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  )}
                </div>

                {/* Cost tiers */}
                <div className="divide-y divide-wv-border/30">
                  {costoTiers.map((tier, tIdx) => (
                    <div key={tIdx} className="px-3 py-1.5 flex items-center gap-2">
                      <div className="w-20 shrink-0">
                        <NumericInput value={tier} onChange={(v) => setCostoTiers(prev => { const n = [...prev]; n[tIdx] = v; return n; })} />
                      </div>
                      <p className="text-[9px] text-muted-foreground shrink-0">sem →</p>
                      <div className="w-24 shrink-0">
                        <NumericInput
                          value={costoMatrix[activeEdadTab]?.[tIdx] ?? 0}
                          onChange={(v) => setCostoMatrix(prev => { const n = prev.map(r => [...r]); n[activeEdadTab][tIdx] = v; return n; })}
                          prefix="$"
                        />
                      </div>
                      <p className="flex-1 text-[9px] sm:text-[10px] text-muted-foreground truncate">{makeTierLabel(costoTiers, tIdx)}</p>
                      {costoTiers.length > 1 && (
                        <button
                          onClick={() => {
                            setCostoTiers(prev => prev.filter((_, i) => i !== tIdx));
                            setCostoMatrix(prev => prev.map(row => row.filter((_, i) => i !== tIdx)));
                          }}
                          className="text-wv-red/50 hover:text-wv-red p-0.5 shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="px-3 py-1.5 border-t border-wv-border/30">
                  <button
                    onClick={() => {
                      setCostoTiers(prev => [...prev, 0]);
                      setCostoMatrix(prev => prev.map(row => [...row, 0]));
                    }}
                    className="text-[9px] sm:text-[10px] text-wv-cyan hover:text-wv-cyan/80 font-medium"
                  >
                    + Agregar tier
                  </button>
                </div>
              </div>
            </div>

            {/* Matrix preview */}
            <div>
              <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Vista Previa</p>
              <div className="rounded-lg border border-wv-border/50 overflow-x-auto">
                <table className="w-full text-[8px] sm:text-[9px]">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="px-2 py-1 text-left font-medium text-muted-foreground sticky left-0 bg-muted/40">Semanas</th>
                      {rangosEdad.map((r, eIdx) => (
                        <th key={eIdx} className="px-2 py-1 text-right font-medium text-muted-foreground whitespace-nowrap">
                          <div>{rangoEdadLabel(rangosEdad, eIdx)}</div>
                          <div className="font-mono text-[7px] sm:text-[8px]">{formatInt(r.semanas)} sem</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {costoTiers.map((_, tIdx) => (
                      <tr key={tIdx} className="border-t border-wv-border/30">
                        <td className="px-2 py-1 text-muted-foreground sticky left-0 bg-background whitespace-nowrap">{makeTierLabel(costoTiers, tIdx)}</td>
                        {rangosEdad.map((__, eIdx) => (
                          <td key={eIdx} className="px-2 py-1 text-right font-mono">{formatMXN(costoMatrix[eIdx]?.[tIdx] ?? 0)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reglas de Calificación Configurables */}
            <div>
              <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reglas de Calificación</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Ahora */}
                <div className="bg-background rounded-lg border border-wv-border/50 p-3 space-y-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-wv-cyan">Ahora</p>
                  <RuleInput label="Edad min." rule={rules.ahoraEdad} ruleKey="ahoraEdad" onChange={updateRule} />
                  <RuleInput label="Meses sin cot. >" rule={rules.ahoraMeses} ruleKey="ahoraMeses" onChange={updateRule} />
                </div>
                {/* Futuro */}
                <div className="bg-background rounded-lg border border-wv-border/50 p-3 space-y-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-wv-cyan">Futuro</p>
                  <RuleInput label="Edad min." rule={rules.futuroEdad} ruleKey="futuroEdad" onChange={updateRule} />
                  <RuleInput label="Meses sin cot. >" rule={rules.futuroMeses} ruleKey="futuroMeses" onChange={updateRule} />
                </div>
                {/* Recuperar Derechos */}
                <div className="bg-background rounded-lg border border-wv-border/50 p-3 space-y-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-wv-cyan">Recuperar Derechos</p>
                  <RuleInput label="Edad min." rule={rules.recupEdad} ruleKey="recupEdad" onChange={updateRule} />
                  <RuleInput label="Semanas min." rule={rules.recupSemMin} ruleKey="recupSemMin" onChange={updateRule} />
                  <RuleInput label="AFORE min." rule={rules.recupAfore} ruleKey="recupAfore" onChange={updateRule} />
                </div>
                {/* ActMin */}
                <div className="bg-background rounded-lg border border-wv-border/50 p-3 space-y-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-wv-cyan">Act. Pensión Mínima</p>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={rules.actMinEdad.enabled}
                      onChange={(e) => updateRule("actMinEdad", "enabled", e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-wv-border accent-wv-cyan" />
                    <span className={`text-[10px] sm:text-xs ${rules.actMinEdad.enabled ? "text-foreground" : "text-muted-foreground line-through"} min-w-[60px]`}>Edad min.</span>
                    <input type="text" inputMode="numeric" value={rules.actMinEdad.value || ""} disabled={!rules.actMinEdad.enabled}
                      onChange={(e) => updateRule("actMinEdad", "value", parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                      className="w-12 rounded-lg border border-wv-border bg-background px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-wv-cyan disabled:opacity-40" />
                    <span className="text-[10px] text-muted-foreground">a</span>
                    <input type="text" inputMode="numeric" value={rules.actMinEdadMeses.value || ""} disabled={!rules.actMinEdad.enabled}
                      onChange={(e) => updateRule("actMinEdadMeses", "value", parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                      className="w-10 rounded-lg border border-wv-border bg-background px-2 py-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-wv-cyan disabled:opacity-40" />
                    <span className="text-[10px] text-muted-foreground">m</span>
                  </div>
                  <RuleInput label="Semanas min." rule={rules.actMinSemanas} ruleKey="actMinSemanas" onChange={updateRule} />
                  <RuleInput label="Días sin cot." rule={rules.actMinSinCotizar} ruleKey="actMinSinCotizar" onChange={updateRule} />
                </div>
                {/* Comp500 */}
                <div className="bg-background rounded-lg border border-wv-border/50 p-3 space-y-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-wv-cyan">Completar 500 Sem.</p>
                  <RuleInput label="Edad min." rule={rules.comp500Edad} ruleKey="comp500Edad" onChange={updateRule} />
                  <RuleInput label="Semanas min." rule={rules.comp500SemMin} ruleKey="comp500SemMin" onChange={updateRule} />
                  <RuleInput label="Semanas máx." rule={rules.comp500SemMax} ruleKey="comp500SemMax" onChange={updateRule} />
                  <RuleInput label="AFORE min." rule={rules.comp500Afore} ruleKey="comp500Afore" onChange={updateRule} />
                </div>
                {/* Vigencia Mod 40 */}
                <div className="bg-background rounded-lg border border-wv-border/50 p-3 space-y-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-wv-cyan">Vigencia Mod. 40</p>
                  <RuleInput label="Mod40 (días)" rule={rules.mod40Dias} ruleKey="mod40Dias" onChange={updateRule} />
                  <RuleInput label="Mod10 (días)" rule={rules.mod10Dias} ruleKey="mod10Dias" onChange={updateRule} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

            {!modoManual ? (
              <>
                <PdfUpload
                  onTextExtracted={handleTextExtracted}
                  isProcessing={isProcessing}
                />
                <div className="text-center">
                  <button type="button" onClick={() => setModoManual(true)}
                    className="text-xs text-wv-cyan hover:text-wv-cyan/80 font-medium transition-colors">
                    Registro manual
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-wv-surface rounded-xl border border-wv-border p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Registro Manual</p>
                  <button type="button" onClick={() => setModoManual(false)}
                    className="text-xs text-muted-foreground hover:text-foreground">Subir PDF</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] sm:text-xs text-muted-foreground">Inicio cotización</label>
                    <div className="flex gap-1.5">
                      <select value={manualInicioMes} onChange={(e) => setManualInicioMes(Number(e.target.value))}
                        className="flex-1 rounded-lg border border-wv-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-wv-cyan">
                        {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map((m, i) => (
                          <option key={i} value={i}>{m}</option>
                        ))}
                      </select>
                      <input type="text" inputMode="numeric" value={manualInicioAnio || ""} placeholder="1995"
                        onChange={(e) => setManualInicioAnio(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                        className="w-16 rounded-lg border border-wv-border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-wv-cyan" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] sm:text-xs text-muted-foreground">Fecha de nacimiento</label>
                    <div className="flex gap-1">
                      <input type="text" inputMode="numeric" value={manualFechaNacDia || ""} placeholder="DD"
                        onChange={(e) => setManualFechaNacDia(Math.min(31, parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0))}
                        className="w-10 rounded-lg border border-wv-border bg-background px-1.5 py-1.5 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-wv-cyan" />
                      <input type="text" inputMode="numeric" value={manualFechaNacMes || ""} placeholder="MM"
                        onChange={(e) => setManualFechaNacMes(Math.min(12, parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0))}
                        className="w-10 rounded-lg border border-wv-border bg-background px-1.5 py-1.5 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-wv-cyan" />
                      <input type="text" inputMode="numeric" value={manualFechaNacAnio || ""} placeholder="AAAA"
                        onChange={(e) => setManualFechaNacAnio(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                        className="w-14 rounded-lg border border-wv-border bg-background px-1.5 py-1.5 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-wv-cyan" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] sm:text-xs text-muted-foreground">Última cotización</label>
                    <div className="flex gap-1.5">
                      <select value={manualUltimaCotMes} onChange={(e) => setManualUltimaCotMes(Number(e.target.value))}
                        className="flex-1 rounded-lg border border-wv-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-wv-cyan">
                        {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map((m, i) => (
                          <option key={i} value={i + 1}>{m}</option>
                        ))}
                      </select>
                      <input type="text" inputMode="numeric" value={manualUltimaCotAnio || ""} placeholder="2020"
                        onChange={(e) => setManualUltimaCotAnio(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                        className="w-16 rounded-lg border border-wv-border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-wv-cyan" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] sm:text-xs text-muted-foreground">Semanas cotizadas</label>
                    <NumericInput value={manualSemanas} onChange={setManualSemanas} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] sm:text-xs text-muted-foreground">Promedio salarial diario</label>
                    <NumericInput value={manualPromedio} onChange={setManualPromedio} prefix="$" className="max-w-[200px]" />
                  </div>
                </div>
                <button type="button"
                  onClick={() => {
                    const fechaNac = new Date(Date.UTC(manualFechaNacAnio, manualFechaNacMes - 1, manualFechaNacDia));
                    const ultimaCot = new Date(Date.UTC(manualUltimaCotAnio, manualUltimaCotMes - 1, 15));
                    const isLey73Manual = manualInicioAnio < 1997 || (manualInicioAnio === 1997 && manualInicioMes < 6);
                    const curpYear = manualFechaNacAnio.toString().slice(-2);
                    const curpMM = String(manualFechaNacMes).padStart(2, "0");
                    const curpDD = String(manualFechaNacDia).padStart(2, "0");
                    const fakeCurp = `XXXX${curpYear}${curpMM}${curpDD}XXXXXX00`;
                    const manualResult: ApiResult = {
                      regimen: isLey73Manual ? "ley73" : "ley97",
                      header: {
                        nombre: "Registro Manual",
                        nss: "",
                        curp: fakeCurp,
                        totalSemanasCotizadas: manualSemanas,
                        semanasReconocidas: manualSemanas,
                        semanasDescontadas: 0,
                        semanasReintegradas: 0,
                      },
                      records: [{
                        patron: "Manual",
                        registroPatronal: "Y0000000000",
                        entidadFederativa: "",
                        fechaAlta: `01/${String(manualInicioMes + 1).padStart(2, "0")}/${manualInicioAnio}`,
                        fechaBaja: `15/${String(manualUltimaCotMes).padStart(2, "0")}/${manualUltimaCotAnio}`,
                        salarioBaseCotizacion: manualPromedio,
                      }],
                      salaryAverage: {
                        promedio: manualPromedio,
                        periods: [{
                          fechaAlta: `01/${String(manualInicioMes + 1).padStart(2, "0")}/${manualInicioAnio}`,
                          fechaBaja: `15/${String(manualUltimaCotMes).padStart(2, "0")}/${manualUltimaCotAnio}`,
                          salarioDiario: manualPromedio,
                          dias: manualSemanas * 7,
                          semanasTotales: manualSemanas,
                          semanasContadas: Math.min(manualSemanas, 250),
                          resultado: Math.min(manualSemanas, 250) * manualPromedio,
                        }],
                      },
                      afore: {
                        sar92: { aportaciones: 0, rendimientos: 0, total: 0 },
                        vivienda92: { aportaciones: 0, rendimientos: 0, total: 0 },
                        retiro: { aportaciones: 0, rendimientos: 0, total: 0 },
                        ceavTrabajador: { aportaciones: 0, rendimientos: 0, total: 0 },
                        ceavPatron: { aportaciones: 0, rendimientos: 0, total: 0 },
                        cuotaSocial: { aportaciones: 0, rendimientos: 0, total: 0 },
                        vivienda97: { aportaciones: 0, rendimientos: 0, total: 0 },
                        totalRCV: 0, totalRCVBruto: 0, totalSAR92: 0, totalVivienda: 0, saldoTotal: 0,
                      },
                      retirosDesempleo: { retiros: [], totalDevolver: 0 },
                    };
                    setResult(manualResult);
                  }}
                  disabled={!manualSemanas || !manualPromedio || !manualFechaNacAnio}
                  className="w-full py-2.5 rounded-xl bg-wv-cyan text-background font-semibold text-sm transition-colors hover:bg-wv-cyan/90 disabled:opacity-40 disabled:cursor-not-allowed">
                  Calcular
                </button>
              </div>
            )}

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
              {calificacionLabel && (
                <div className="mt-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${calificacionPositiva ? "bg-wv-green/15 text-wv-green" : "bg-wv-red/15 text-wv-red"}`}>
                    {calificacionLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Calificación — formulario interactivo */}
            {isLey73 && (
              <section className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden no-print">
                <DetailToggle label="Calificación" defaultOpen={true} section><div className="space-y-3 px-4 sm:px-5">

                {/* 1. ¿Está pensionado? */}
                <div className="space-y-1.5">
                  <p className="text-xs sm:text-sm font-medium">¿Está pensionado?</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setCalPensionado("no")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${calPensionado === "no" ? "bg-wv-green/20 border-wv-green text-wv-green" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                      No
                    </button>
                    <button type="button" onClick={() => setCalPensionado("temporal")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${calPensionado === "temporal" ? "bg-wv-green/20 border-wv-green text-wv-green" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                      Sí — Temporal
                    </button>
                    <button type="button" onClick={() => setCalPensionado("definitivo")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${calPensionado === "definitivo" ? "bg-wv-red/20 border-wv-red text-wv-red" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                      Sí — Definitivo
                    </button>
                  </div>
                  {calPensionado === "definitivo" && (
                    <p className="text-[10px] text-wv-red">Pensionado definitivo — no califica para financiamiento</p>
                  )}
                </div>

                {/* 2. Necesidad */}
                {calPensionado !== "definitivo" && (
                  <div className="space-y-1.5">
                    <p className="text-xs sm:text-sm font-medium">¿Necesita financiamiento?</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setCalNecesidad("si")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${calNecesidad === "si" ? "bg-wv-green/20 border-wv-green text-wv-green" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        Sí, necesita financiamiento
                      </button>
                      <button type="button" onClick={() => setCalNecesidad("no")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${calNecesidad === "no" ? "bg-wv-red/20 border-wv-red text-wv-red" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        No, solo busca asesoría
                      </button>
                    </div>
                    {calNecesidad === "no" && (
                      <p className="text-[10px] text-wv-red">No necesita financiamiento — descalificado</p>
                    )}
                  </div>
                )}

                {/* 3. Simulación */}
                {calPensionado !== "definitivo" && calNecesidad !== "no" && (
                  <div className="space-y-1.5">
                    <p className="text-xs sm:text-sm font-medium">¿Tiene simulación de pensión?</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setCalSimulacion("no")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${calSimulacion === "no" ? "bg-wv-green/20 border-wv-green text-wv-green" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        No
                      </button>
                      <button type="button" onClick={() => setCalSimulacion("si_timbrados")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${calSimulacion === "si_timbrados" ? "bg-wv-green/20 border-wv-green text-wv-green" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        Sí — Están timbrados
                      </button>
                      <button type="button" onClick={() => setCalSimulacion("si_no_timbrados")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${calSimulacion === "si_no_timbrados" ? "bg-wv-red/20 border-wv-red text-wv-red" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        Sí — No están timbrados
                      </button>
                    </div>
                    {calSimulacion === "si_no_timbrados" && (
                      <p className="text-[10px] text-wv-red">Simulación no timbrada — descalificado</p>
                    )}
                  </div>
                )}

                {/* 4. Demandas */}
                {calPensionado !== "definitivo" && calNecesidad !== "no" && calSimulacion !== "si_no_timbrados" && (
                  <div className="space-y-1.5">
                    <p className="text-xs sm:text-sm font-medium">¿Tiene demandas?</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setCalDemandas("no")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${calDemandas === "no" ? "bg-wv-green/20 border-wv-green text-wv-green" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        No
                      </button>
                      <button type="button" onClick={() => setCalDemandas("conciliacion")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${calDemandas === "conciliacion" ? "bg-wv-green/20 border-wv-green text-wv-green" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        Sí — En conciliación y arbitraje
                      </button>
                      <button type="button" onClick={() => setCalDemandas("avanzada")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${calDemandas === "avanzada" ? "bg-wv-red/20 border-wv-red text-wv-red" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        Sí — Ya avanzó la demanda
                      </button>
                    </div>
                    {calDemandas === "avanzada" && (
                      <p className="text-[10px] text-wv-red">Demanda avanzada — descalificado</p>
                    )}
                  </div>
                )}

                {/* 5. Crédito INFONAVIT */}
                {!calDescalificado && (
                  <div className="space-y-1.5">
                    <p className="text-xs sm:text-sm font-medium">¿Tiene crédito INFONAVIT?</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" onClick={() => { setTieneCredito(false); setMontoCredito(0); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${!tieneCredito ? "bg-wv-green/20 border-wv-green text-wv-green" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        No
                      </button>
                      <button type="button" onClick={() => setTieneCredito(true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${tieneCredito ? "bg-wv-cyan/20 border-wv-cyan text-wv-cyan" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        Sí
                      </button>
                      {tieneCredito && (
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-xs text-muted-foreground">Saldo:</span>
                          <div className="relative">
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
                              className="w-28 rounded-lg border border-wv-border bg-background pl-6 pr-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-wv-cyan focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 6. Estado de cuenta AFORE */}
                {!calDescalificado && (
                  <div className="space-y-1.5">
                    <p className="text-xs sm:text-sm font-medium">¿Tiene estado de cuenta de AFORE?</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" onClick={() => { setTieneEstadoCuentaAfore(false); setSaldoAforeManual(0); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${!tieneEstadoCuentaAfore ? "bg-wv-green/20 border-wv-green text-wv-green" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        No
                      </button>
                      <button type="button" onClick={() => setTieneEstadoCuentaAfore(true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${tieneEstadoCuentaAfore ? "bg-wv-cyan/20 border-wv-cyan text-wv-cyan" : "border-wv-border text-muted-foreground hover:border-foreground"}`}>
                        Sí
                      </button>
                      {tieneEstadoCuentaAfore && (
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-xs text-muted-foreground">Saldo AFORE a regresar:</span>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={saldoAforeManual ? formatInt(saldoAforeManual) : ""}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, "");
                                setSaldoAforeManual(raw ? Math.max(0, Number(raw)) : 0);
                              }}
                              placeholder="0"
                              className="w-32 rounded-lg border border-wv-border bg-background pl-6 pr-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-wv-cyan focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 7. Reintegro de semanas */}
                {result.header.semanasDescontadas > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-xs sm:text-sm font-medium">Reintegro de semanas descontadas</p>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={calReintegroManual !== null ? formatInt(calReintegroManual) : formatInt(result.retirosDesempleo?.totalDevolver ?? 0)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            setCalReintegroManual(raw ? Math.max(0, Number(raw)) : 0);
                          }}
                          placeholder="0"
                          className="w-32 rounded-lg border border-wv-border bg-background pl-6 pr-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-wv-cyan focus:border-transparent"
                        />
                      </div>
                    </div>
                    <DetailToggle label="Ver retiros por desempleo">
                      <RetirosDesempleo
                        retiros={result.retirosDesempleo.retiros}
                        semanasDescontadas={result.header.semanasDescontadas}
                        totalRCVBruto={result.afore.totalRCVBruto}
                        semanasReconocidas={result.header.semanasReconocidas}
                      />
                    </DetailToggle>
                  </div>
                )}

                {calDescalificado && (
                  <div className="rounded-lg p-3 bg-wv-red/10 border border-wv-red/20">
                    <p className="text-xs font-medium text-wv-red">Descalificado — no califica para ningún financiamiento</p>
                  </div>
                )}
                </div></DetailToggle>
              </section>
            )}

            {isLey73 && (<>
            {/* Validations — collapsible */}
            <section className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
              <DetailToggle label="Resultado de Calificación" defaultOpen={true} section>
              <div className="space-y-2 sm:space-y-2.5">
                <p className="px-3.5 sm:px-4 text-xs sm:text-sm font-bold text-foreground underline">Fin. Mod. 40 Retroactivo</p>
                {/* Ley 73 */}
                <div className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5">
                  <p className={`font-medium text-xs sm:text-sm ${isLey73 ? "" : "text-wv-red"}`}>Ley 73</p>
                  <span className={`text-[10px] sm:text-xs font-mono ${isLey73 ? "text-muted-foreground" : "text-wv-red"}`}>
                    {isLey73 && primeraCotizacion
                      ? `inició ${primeraCotizacion.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}`
                      : isLey73 ? "Ley 73" : "No es Ley 73"}
                  </span>
                </div>

                {/* Semanas Cotizadas — age-based ranges */}
                <ToggleSection
                  header={
                    <div className="flex items-center gap-2">
                      <p className={`font-medium text-xs sm:text-sm ${cumpleSemanas ? "" : "text-wv-red"}`}>Semanas Cotizadas</p>
                      <span className={`text-[10px] sm:text-xs font-mono font-semibold ${cumpleSemanas ? "" : "text-wv-red"}`}>
                        {formatInt(semanasTotales)} / {formatInt(semanasMinimas)} mínimo
                      </span>
                    </div>
                  }
                >
                      <div className="rounded-lg border border-wv-border overflow-hidden font-sans">
                        <table className="w-full text-[10px] sm:text-xs">
                          <thead>
                            <tr className="bg-muted/40">
                              <th className="px-2.5 sm:px-3 py-1.5 text-left font-medium text-muted-foreground w-16">Sem.</th>
                              <th className="px-2.5 sm:px-3 py-1.5 text-left font-medium text-muted-foreground">Edad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rangosEdad.map((r, i) => {
                              const isActive = i === semanasRangoIndex;
                              return (
                                <tr
                                  key={i}
                                  className={isActive
                                    ? "bg-wv-cyan/10 font-semibold"
                                    : "border-t border-wv-border/50"}
                                >
                                  <td className={`px-2.5 sm:px-3 py-2 sm:py-2.5 font-mono ${isActive ? "text-wv-cyan" : ""}`}>{formatInt(r.semanas)}</td>
                                  <td className={`px-2.5 sm:px-3 py-2 sm:py-2.5 ${isActive ? "text-wv-cyan" : "text-muted-foreground"}`}>{rangoEdadLabel(rangosEdad, i)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className={`grid ${result.header.semanasDescontadas > 0 ? "grid-cols-3" : "grid-cols-1"} gap-1.5 sm:gap-2 mt-2 font-sans`}>
                        <div className="bg-muted/60 rounded-lg p-2">
                          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cotizadas</p>
                          <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5">{formatInt(result.header.totalSemanasCotizadas)}</p>
                        </div>
                        {result.header.semanasDescontadas > 0 && (
                          <div className="bg-muted/60 rounded-lg p-2">
                            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Descontadas</p>
                            <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5 text-wv-red">{formatInt(result.header.semanasDescontadas)}</p>
                          </div>
                        )}
                        {result.header.semanasDescontadas > 0 && (
                          <div className="bg-muted/60 rounded-lg p-2">
                            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Reintegradas</p>
                            <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5 text-wv-green">{formatInt(result.header.semanasReintegradas)}</p>
                          </div>
                        )}
                      </div>
                </ToggleSection>

                {/* Saldo AFORE */}
                <ToggleSection
                  header={
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-xs sm:text-sm ${cumpleAfore ? "" : "text-wv-red"}`}>Saldo AFORE</p>
                        <span className={`text-[10px] sm:text-xs font-mono font-semibold ${cumpleAfore ? "" : "text-wv-red"}`}>
                          {formatMXN(saldoAfore)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] sm:text-xs text-muted-foreground">
                        <span>Sin trabajar: {sinTrabajar ? `${sinTrabajar.anos}a ${sinTrabajar.meses}m ${sinTrabajar.diasRestantes}d` : "—"}</span>
                        <span>Requerido: {formatMXN(montoRequerido)}</span>
                        <span>Saldo actual: {formatMXN(saldoAfore)}{tieneEstadoCuentaAfore && saldoAforeManual > 0 ? " (manual)" : ""}</span>
                      </div>
                    </div>
                  }
                >
                      <p className="text-muted-foreground/70 mb-1 font-sans">Rango de edad: {rangoEdadLabel(rangosEdad, semanasRangoIndex)}</p>
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
                            {costoTiers.map((_, i) => {
                              const costoVal = (costoMatrix[semanasRangoIndex] ?? costoMatrix[0])[i];
                              const isActive = i === costoRangoIndex;
                              return (
                                <tr
                                  key={i}
                                  className={isActive
                                    ? "bg-wv-cyan/10 font-semibold"
                                    : "border-t border-wv-border/50"}
                                >
                                  <td className={`px-2.5 sm:px-3 py-1 ${isActive ? "text-wv-cyan" : "text-muted-foreground"}`}>{makeTierLabel(costoTiers, i)}</td>
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
                        <StepRow label={`Rango edad: ${rangoEdadLabel(rangosEdad, semanasRangoIndex)}`} value={`Tier: ${makeTierLabel(costoTiers, costoRangoIndex)}`} />
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
                </ToggleSection>

                {/* Modalidad (filtro) */}
                {(modalidad === "mod10" || modalidad === "mod40") && (
                  <div>
                    {modalidad === "mod10" && (
                      <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className={`font-medium text-xs sm:text-sm ${mod10Cumple ? "" : "text-wv-red"}`}>
                              Derecho Mod. 40
                            </p>
                            <span className="text-[10px] sm:text-xs font-mono text-muted-foreground flex items-center gap-2">
                              RP: {ultimoRegistro?.registroPatronal.slice(-2)}
                              {vigenciaMod40 && (
                                <span className={mod10Cumple && vigenciaMod40Activa ? "text-wv-green" : vigenciaMod40Activa ? "text-amber-500" : "text-wv-red"}>
                                  {vigenciaMod40Activa
                                    ? (mod10Cumple ? "Pierde derecho:" : "No cumple — plazo hasta:")
                                    : "Perdió derecho:"} {vigenciaMod40.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <SubCheck
                              pass={mod10CumpleTiempo}
                              label={`Conservación (máx. ${formatDiasCompleto(LIMITE_MOD10_DIAS)})`}
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
                    )}

                    {modalidad === "mod40" && (
                      <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`font-medium text-xs sm:text-sm ${mod40Cumple ? "" : "text-wv-red"}`}>
                            Modalidad 40
                          </p>
                          <span className="text-[10px] sm:text-xs font-mono text-muted-foreground">
                            RP: {ultimoRegistro?.registroPatronal.slice(-2)}
                          </span>
                        </div>
                        <SubCheck
                          pass={mod40Cumple}
                          label={`Máx. ${formatDiasCompleto(LIMITE_MOD40_DIAS)} sin cotizar`}
                          value={`${formatDiasCompleto(diasSinCotizar)} (${diasSinCotizar} días)`}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Financiamiento — decisión clave para el asesor */}
                {edadInfo && (
                  <div className="space-y-2 sm:space-y-2.5">
                    {/* Fila 1: Ahora + Futuro */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 p-2 sm:p-2.5 rounded-xl border border-wv-border/50 bg-wv-surface/30">
                      <div className={`rounded-lg overflow-hidden border ${acreditaAhora ? "border-wv-green/40 bg-gradient-to-br from-wv-surface to-wv-green/5" : "border-wv-red/30 bg-gradient-to-br from-wv-surface to-wv-red/5"}`}>
                        <div className="px-3 sm:px-4 py-2 sm:py-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-xs sm:text-sm">Ahora</p>
                            <StatusBadge pass={acreditaAhora} labelPass="Acredita" labelFail="No acredita" />
                          </div>
                          <div className="space-y-0.5">
                            <SubCheck pass={asesoriaAhoraCumpleEdad} label={rules.ahoraEdad.enabled ? `Edad min. ${rules.ahoraEdad.value}` : "Edad (desact.)"} value={`${edad} años`} />
                            <SubCheck pass={asesoriaAhoraCumpleMeses} label={rules.ahoraMeses.enabled ? `> ${rules.ahoraMeses.value} meses sin cotizar` : "Meses (desact.)"} value={sinTrabajar ? `${sinTrabajar.anos}a ${sinTrabajar.meses}m ${sinTrabajar.diasRestantes}d` : `${mesesSinCotizar} meses`} />
                          </div>
                        </div>
                      </div>

                      <div className={`rounded-lg overflow-hidden border ${acreditaFuturo ? "border-wv-green/40 bg-gradient-to-br from-wv-surface to-wv-green/5" : "border-wv-red/30 bg-gradient-to-br from-wv-surface to-wv-red/5"}`}>
                        <div className="px-3 sm:px-4 py-2 sm:py-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-xs sm:text-sm">Futuro</p>
                            <StatusBadge pass={acreditaFuturo} labelPass="Acredita" labelFail="No acredita" />
                          </div>
                          <div className="space-y-0.5">
                            <SubCheck pass={asesoriaFuturoCumpleEdad} label={rules.futuroEdad.enabled ? `Edad min. ${rules.futuroEdad.value}` : "Edad (desact.)"} value={`${edad} años`} />
                            <SubCheck pass={asesoriaFuturoCumpleMeses} label={rules.futuroMeses.enabled ? `> ${rules.futuroMeses.value} meses sin cotizar` : "Meses (desact.)"} value={sinTrabajar ? `${sinTrabajar.anos}a ${sinTrabajar.meses}m ${sinTrabajar.diasRestantes}d` : `${mesesSinCotizar} meses`} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fila 2: Recuperar Derechos + Act. Pensión Mínima + Completar 500 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 p-2 sm:p-2.5 rounded-xl border border-wv-border/50 bg-wv-surface/30">
                      <div
                        className={`rounded-lg overflow-hidden border ${acreditaRecuperacion ? "border-wv-green/40 bg-gradient-to-br from-wv-surface to-wv-green/5" : "border-wv-red/30 bg-gradient-to-br from-wv-surface to-wv-red/5"}`}
                      >
                        <div className="px-3 sm:px-4 py-2 sm:py-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-xs sm:text-sm">Recuperar Derechos</p>
                            <StatusBadge pass={acreditaRecuperacion} labelPass="Acredita" labelFail="No acredita" />
                          </div>
                          <div className="space-y-0.5">
                            <SubCheck pass={perdioDerechos} label="Perdió derechos" value={perdioDerechos ? "Sí" : "No"} />
                            <SubCheck pass={recupCumpleEdad} label={rules.recupEdad.enabled ? `Edad min. ${rules.recupEdad.value}` : "Edad (desact.)"} value={`${edad} años`} />
                            <SubCheck pass={recupCumpleSemanas} label={rules.recupSemMin.enabled ? `Min. ${formatInt(rules.recupSemMin.value)} semanas` : "Semanas (desact.)"} value={`${formatInt(semanasTotales)} sem`} />
                            <SubCheck pass={recupCumpleAfore} label={rules.recupAfore.enabled ? `AFORE min. ${formatMXN(rules.recupAfore.value)}` : "AFORE (desact.)"} value={modoManual ? "N/A" : formatMXN(saldoAfore)} />
                          </div>
                        </div>
                      </div>

                      <div
                        className={`rounded-lg overflow-hidden border ${actMinAcredita ? "border-wv-green/40 bg-gradient-to-br from-wv-surface to-wv-green/5" : "border-wv-red/30 bg-gradient-to-br from-wv-surface to-wv-red/5"}`}
                      >
                        <div className="px-3 sm:px-4 py-2 sm:py-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-xs sm:text-sm">Actualización Pensión Mínima</p>
                            <StatusBadge pass={actMinAcredita} labelPass="Acredita" labelFail="No acredita" />
                          </div>
                          <div className="space-y-0.5">
                            <SubCheck pass={actMinCumpleEdad} label={rules.actMinEdad.enabled ? `Edad min. ${rules.actMinEdad.value}a ${rules.actMinEdadMeses.value}m` : "Edad (desact.)"} value={edadExacta ? `${edadExacta.anos}a ${edadExacta.meses}m` : `${edad} años`} />
                            <SubCheck pass={actMinCumpleSemanas} label={rules.actMinSemanas.enabled ? `Min. ${formatInt(rules.actMinSemanas.value)} semanas` : "Semanas (desact.)"} value={`${formatInt(semanasTotales)} sem`} />
                            <SubCheck pass={actMinCumpleSinCotizar} label={rules.actMinSinCotizar.enabled ? `Min. ${formatInt(rules.actMinSinCotizar.value)} días sin cot.` : "Sin cotizar (desact.)"} value={sinTrabajar ? `${sinTrabajar.anos}a ${sinTrabajar.meses}m` : `${Math.floor(diasSinCotizar / 365)}a`} />
                            <SubCheck pass={actMinCumplePension} label={modoManual ? "Pensión mínima (asumido)" : `Pensión < mínima (${formatMXN(pensionMinimaVigente)})`} value={modoManual ? "Sí" : (escenarios ? formatMXN(escenarios.pensionActual.pensionBruta) : "$0")} />
                          </div>
                        </div>
                      </div>

                      <div
                        className={`rounded-lg overflow-hidden border ${comp500Acredita ? "border-wv-green/40 bg-gradient-to-br from-wv-surface to-wv-green/5" : "border-wv-red/30 bg-gradient-to-br from-wv-surface to-wv-red/5"}`}
                      >
                        <div className="px-3 sm:px-4 py-2 sm:py-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-xs sm:text-sm">Completar 500 Semanas</p>
                            <StatusBadge pass={comp500Acredita} labelPass="Sí califica" labelFail="No califica" />
                          </div>
                          <div className="space-y-0.5">
                            <SubCheck pass={comp500CumpleEdad} label={rules.comp500Edad.enabled ? `Edad min. ${rules.comp500Edad.value}` : "Edad (desact.)"} value={`${edad} años`} />
                            <SubCheck pass={comp500CumpleSemanas} label={rules.comp500SemMin.enabled ? `Min. ${formatInt(rules.comp500SemMin.value)} semanas` : "Sem. mín (desact.)"} value={`${formatInt(semanasTotales)} semanas`} />
                            <SubCheck pass={comp500CumpleMax} label={rules.comp500SemMax.enabled ? `Máx. ${formatInt(rules.comp500SemMax.value)} semanas` : "Sem. máx (desact.)"} value={`${formatInt(semanasTotales)} semanas`} />
                            <SubCheck pass={comp500CumpleAfore} label={rules.comp500Afore.enabled ? `AFORE min. ${formatMXN(rules.comp500Afore.value)}` : "AFORE (desact.)"} value={modoManual ? "N/A" : formatMXN(saldoAfore)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Conservación de Derechos — Art. 150/151 */}
                {edadInfo && isLey73 && (
                  <div className="px-3.5 sm:px-4 py-2 sm:py-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`font-medium text-xs sm:text-sm ${perdioDerechos ? "text-amber-500" : ""}`}>Derecho para poderte pensionar</p>
                        <span className={`text-[10px] sm:text-xs font-mono ${perdioDerechos ? "text-amber-500" : "text-muted-foreground"}`}>
                          {perdioDerechos ? "Perdió derechos" : "Vigente"}
                          {vigenciaPension && !perdioDerechos && vigenciaPensionActiva && (
                            <span className="ml-2 text-wv-green">
                              Pierde: {vigenciaPension.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
                            </span>
                          )}
                          {perdioDerechos && rightsHistory?.lastLossDate && (
                            <span className="ml-2 text-wv-red">
                              Perdió: {rightsHistory.lastLossDate.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] sm:text-xs font-mono">
                        <span className="text-muted-foreground">Conservación: <strong>{formatDiasCompleto(diasConservacion)}</strong> ({formatInt(semanasConservacion)} sem)</span>
                        <span className={perdioDerechos ? "text-amber-500" : "text-muted-foreground"}>Sin cotizar: <strong>{sinTrabajar ? `${sinTrabajar.anos}a ${sinTrabajar.meses}m ${sinTrabajar.diasRestantes}d` : "0d"}</strong> ({formatInt(diasSinCotizar)}d)</span>
                      </div>

                      {perdioDerechos && (
                        <DetailToggle label={`Art. 151 — ${semanasNuevasRequeridas === 0 ? "Cotizar 1 mes en Mod 10" : `${semanasNuevasRequeridas} semanas nuevas requeridas`}`}>
                          <div className="rounded-lg p-2.5 border border-amber-500/20 bg-amber-500/5 space-y-2 font-sans">
                            <p className="text-xs sm:text-sm font-semibold text-amber-500">
                              {semanasNuevasRequeridas === 0
                                ? "Cotizar 1 mes en Mod 10 para recuperar derechos"
                                : `${semanasNuevasRequeridas} semanas nuevas ininterrumpidas requeridas`}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {anosDesdePerdida <= 3
                                ? "Menos de 3 años desde pérdida — cotizar 1 mes en Mod 10 para recuperar"
                                : anosDesdePerdida <= 5
                                  ? "Entre 3 y 5 años — 26 semanas nuevas ininterrumpidas (≈6 meses Mod 10)"
                                  : "Más de 5 años — 52 semanas nuevas ininterrumpidas (≈12 meses Mod 10)"}
                            </p>
                            {rightsHistory && rightsHistory.events.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Rastreabilidad histórica</p>
                                {rightsHistory.events.map((evt, idx) => (
                                  <div key={idx} className={`flex items-start gap-2 text-[10px] sm:text-xs ${evt.type === "recovered" ? "text-wv-green" : "text-amber-500"}`}>
                                    <span className="shrink-0 mt-0.5">{evt.type === "recovered" ? "✓" : evt.type === "not_recovered" ? "✗" : "⚠"}</span>
                                    <span>
                                      {evt.type === "lost" && `Perdió derechos — gap de ${formatDiasCompleto(evt.gapDays)} (conservación: ${formatDiasCompleto(evt.conservationDays)}) entre ${evt.gapStart.toLocaleDateString("es-MX", { timeZone: "UTC" })} y ${evt.gapEnd.toLocaleDateString("es-MX", { timeZone: "UTC" })}`}
                                      {evt.type === "not_recovered" && `No recuperó — cotizó ${evt.weeksWorked} sem (necesitaba ${evt.weeksNeeded}) entre ${evt.gapStart.toLocaleDateString("es-MX", { timeZone: "UTC" })} y ${evt.gapEnd.toLocaleDateString("es-MX", { timeZone: "UTC" })}`}
                                      {evt.type === "recovered" && `Recuperó derechos — cotizó ${evt.weeksWorked} sem (necesitaba ${evt.weeksNeeded})`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </DetailToggle>
                      )}

                      <DetailToggle label="Ver cálculo de conservación">
                        <StepRow label="Semanas cotizadas" value={formatInt(semanasTotales)} />
                        <StepRow label="25% (Art. 150)" value={`${formatInt(semanasTotales)} × 0.25 = ${formatInt(Math.floor(semanasTotales * 0.25))}`} />
                        <StepRow label="Mínimo legal" value="52 semanas (1 año)" />
                        <StepRow label="Conservación aplicada" value={`${formatInt(semanasConservacion)} sem = ${formatDiasCompleto(diasConservacion)}`} highlight />
                        <StepRow label="Días sin cotizar" value={formatInt(diasSinCotizar)} />
                        <StepRow label={perdioDerechos ? "Excede conservación por" : "Margen restante"} value={formatDiasCompleto(Math.abs(diasConservacion - diasSinCotizar))} highlight />
                        {perdioDerechos && (
                          <>
                            <div className="border-t border-wv-border/30 my-1" />
                            <StepRow label="Tiempo desde pérdida" value={`${formatDiasCompleto(diasDesdePerdida)} (${Math.floor(anosDesdePerdida * 10) / 10} años)`} />
                            <StepRow label="Semanas nuevas (Art. 151)" value={`${semanasNuevasRequeridas} semanas`} highlight />
                          </>
                        )}
                      </DetailToggle>
                  </div>
                )}
              </div>
              </DetailToggle>
            </section>

            {!isLey73 && (
              <div className="text-center py-2">
                <Button onClick={handleReset}>Subir otro PDF</Button>
              </div>
            )}

            {isLey73 && (
              <>
                <section className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                  <DetailToggle label="AFORE" defaultOpen={false} section>
                    <div className="px-4 sm:px-5"><ResultsSummary
                      saldoAforeRegresar={saldoAfore}
                      saldoSAR={
                        result.afore.totalSAR92 + result.afore.retiro.total
                      }
                      saldoRCV={result.afore.totalRCV}
                      saldoVivienda={viviendaAjustada}
                    />
                    <div className="mt-3">
                      <AforeBreakdown afore={result.afore} />
                    </div></div>
                  </DetailToggle>
                </section>

                {/* Información del Lead */}
                <section className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                  <DetailToggle label="Información del Lead" defaultOpen={false} section>
                    <div className="space-y-1.5 text-xs sm:text-sm px-4 sm:px-5">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Ley 73</span>
                        <span className={isLey73 ? "text-wv-green font-bold" : "text-wv-red font-bold"}>{isLey73 ? "Sí" : "No"}</span>
                      </div>
                      {primeraCotizacion && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Inicio de cotización</span>
                          <span className="font-mono font-bold">{primeraCotizacion.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Edad</span>
                        <span className={`font-bold ${edad < rules.futuroEdad.value ? "text-wv-red" : ""}`}>
                          {edadExacta ? `${edadExacta.anos}a ${edadExacta.meses}m ${edadExacta.dias}d` : `${edad} años`}
                        </span>
                      </div>
                      {edadInfo?.fechaNacimiento && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Cumple 60 años</span>
                          {(() => {
                            const fn = new Date(edadInfo.fechaNacimiento);
                            const cumple60 = new Date(Date.UTC(fn.getUTCFullYear() + 60, fn.getUTCMonth(), fn.getUTCDate()));
                            const hoy = new Date();
                            const esFuturo = cumple60 > hoy;
                            return <span className={`font-mono font-bold ${esFuturo ? "text-wv-red" : ""}`}>{cumple60.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}</span>;
                          })()}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Semanas cotizadas</span>
                        <span className="font-mono font-bold">{formatInt(result.header.totalSemanasCotizadas)}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Semanas descontadas</span>
                        <span className="font-mono font-bold text-wv-red">{formatInt(result.header.semanasDescontadas)}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Semanas reintegradas</span>
                        <span className="font-mono font-bold text-wv-green">{formatInt(result.header.semanasReintegradas)}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Promedio salarial diario</span>
                        <span className="font-mono font-bold">{formatMXN(result.salaryAverage.promedio)}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Promedio salarial mensual</span>
                        <span className="font-mono font-bold">{formatMXN(result.salaryAverage.promedio * 30)}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Derecho Mod. 40</span>
                        <span className={`font-bold ${vigenciaMod40Activa ? "text-wv-green" : "text-wv-red"}`}>
                          {vigenciaMod40Activa ? "Vigente" : "No vigente"}
                          {vigenciaMod40 && <span className="font-mono font-normal text-[10px] ml-1">({vigenciaMod40.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })})</span>}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Derecho a pensionarse</span>
                        <span className={`font-bold ${vigenciaPensionActiva && !perdioDerechos ? "text-wv-green" : "text-wv-red"}`}>
                          {perdioDerechos ? "Perdió derechos" : vigenciaPensionActiva ? "Vigente" : "Expirado"}
                          {vigenciaPension && <span className="font-mono font-normal text-[10px] ml-1">({vigenciaPension.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })})</span>}
                        </span>
                      </div>
                      {escenarios && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">A recibir al pensionarse</span>
                          <span className="font-mono font-bold">{formatMXN(escenarios.pensionActual.pensionNeta)}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">AFORE total</span>
                        <span className="font-mono font-bold">{formatMXN(saldoAfore)}</span>
                      </div>
                    </div>
                  </DetailToggle>
                </section>

                {/* Guion de Venta — datos + guión de ventas */}
                {escenarios && (
                  <section className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                    <DetailToggle label="Guion de Venta" defaultOpen={!calDescalificado && (acreditaAhora || acreditaFuturo)} section>
                      <div className="space-y-1.5 text-xs sm:text-sm px-4 sm:px-5">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Semanas cotizadas</span>
                          <span className="font-mono font-bold">{formatInt(result.header.totalSemanasCotizadas)}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Semanas descontadas</span>
                          <span className="font-mono font-bold text-wv-red">{formatInt(result.header.semanasDescontadas)}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Semanas reintegradas</span>
                          <span className="font-mono font-bold text-wv-green">{formatInt(result.header.semanasReintegradas)}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Promedio salarial diario</span>
                          <span className="font-mono font-bold">{formatMXN(result.salaryAverage.promedio)}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Promedio salarial mensual</span>
                          <span className="font-mono font-bold">{formatMXN(result.salaryAverage.promedio * 30)}</span>
                        </div>
                        <div className="border-t border-wv-border/30 my-1" />
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Pensión actual</span>
                          <span className="font-mono font-bold">{formatMXN(escenarios.pensionActual.pensionNeta)}</span>
                        </div>
                        {mesesRetroactivo !== null && mesesRetroactivo > 0 && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">Tiempo retroactivo</span>
                            <span className="font-mono font-bold">{mesesRetroactivo} meses</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Pensión pronta (Mod. 40)</span>
                          <span className="font-mono font-bold text-wv-green">{formatMXN(escenarios.pensionPronta.pensionNeta)}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Incremento</span>
                          <span className="font-mono font-bold text-wv-green">+{formatMXN(escenarios.pensionPronta.pensionNeta - escenarios.pensionActual.pensionNeta)}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Pensión 6 meses (Mod. 40)</span>
                          <span className="font-mono font-bold text-wv-green">{formatMXN(escenarios.pension6Meses.pensionNeta)}</span>
                        </div>
                      </div>
                      {(acreditaAhora || acreditaFuturo || acreditaRecuperacion || actMinAcredita || comp500Acredita) && (
                      <div className="border-t border-wv-border/30 mt-3">
                      <div className="px-4 sm:px-5 space-y-6 text-xs sm:text-sm leading-relaxed">
                        {(acreditaAhora || acreditaFuturo) && escenarios && (
                          <div className="space-y-5">
                            <p className="text-sm sm:text-base font-bold text-foreground underline">Situación Deseada</p>
                            <div className="space-y-3 text-foreground/90">
                              <p>Perfecto, y mira, ya tengo los resultados de la calculadora, cuentas con todos los requisitos para que te podamos financiar…</p>
                              <p>en este momento tienes <span className="font-semibold text-foreground">[{formatInt(semanasTotales)}]</span> semanas cotizadas y un promedio salarial de <span className="font-semibold text-foreground">[{formatMXN(result.salaryAverage.promedio)}]</span> pesos al día, eso te daría una pensión en este momento/ a los 60 años de <span className="font-semibold text-foreground">[{formatMXN(escenarios.pensionActual.pensionNeta)}]</span> pesos…</p>
                              {mesesRetroactivo !== null && mesesRetroactivo > 0 && (
                                <p>sí nosotros te financiamos tu modalidad 40 desde que dejaste de trabajar hasta este <span className="font-semibold text-foreground">[{pensionResult?.mesPension.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }) ?? "mes"}]</span>, estaríamos haciendo <span className="font-semibold text-foreground">[{mesesRetroactivo}]</span> meses de retroactivo, tu pensión quedaría aproximadamente en <span className="font-semibold text-wv-green">[{formatMXN(escenarios.pensionPronta.pensionNeta)}]</span>, te incrementa <span className="font-semibold text-wv-green">[{formatMXN(escenarios.pensionPronta.pensionNeta - escenarios.pensionActual.pensionNeta)}]</span> pesos al mes, …</p>
                              )}
                              <p>si te esperas 6 meses más de retroactivo, te subiría <span className="font-semibold text-wv-cyan">[{formatMXN(escenarios.pension6Meses.pensionNeta - escenarios.pensionActual.pensionNeta)}]</span> pesos mensuales…</p>
                              <p>hay veces que si conviene esperar, hay otras que no, ya todo eso lo vas a ver en una asesoría con un experto en pensiones para que tu definas qué es lo que más te conviene…</p>
                              <p>y te comento esto más que nada para tenerlo en cuenta porque, por decir, si lograramos incrementar tu pensión a unos <span className="font-semibold text-foreground">[{formatMXN(escenarios.pensionPronta.pensionNeta)} - {formatMXN(escenarios.pension6Meses.pensionNeta)}]</span> pesos ¿qué impacto tendría en tu vida, en tu retiro?, ¿qué cambiaría?</p>
                            </div>
                            <p className="text-sm sm:text-base font-bold text-foreground underline mt-4">Oferta</p>
                            <div className="space-y-3 text-foreground/90">
                              <p>entiendo, pues mira ya lo que se hacemos aquí es agendarte una asesoría con nuestro asesor experto en financiamientos, básicamente es una videollamada donde se primero, revisan todas las opciones que tienes para ver cual es la mejor pensión que puedes alcanzar y después te explica cómo haríamos tu financiamiento y el paso a paso de que sigue, de cómo avanzar…</p>
                              <p className="text-wv-cyan italic">¿para ti sería viable que revisara si pudiera agendarte esta asesoría con nuestro experto?</p>
                            </div>
                          </div>
                        )}

                        {acreditaRecuperacion && !acreditaAhora && !acreditaFuturo && (
                          <div className="space-y-5">
                            <p className="text-sm sm:text-base font-bold text-foreground underline">Recuperar Derechos</p>
                            <div className="space-y-3 text-foreground/90">
                              <p>perfecto, pues mira, en tu caso en este momento no tienes derechos de pensión porque llevas sin trabajar, más del 25% de las semanas que tienes cotizadas, o sea, tienes <span className="font-semibold text-foreground">[{formatInt(semanasTotales)}]</span> semanas cotizadas, se puede estar sin trabajar <span className="font-semibold text-foreground">[{formatInt(semanasConservacion)} sem / {Math.floor(diasConservacion / 365)}a {Math.floor((diasConservacion % 365) / 30)}m {(diasConservacion % 365) % 30}d]</span> pero tu ya llevas <span className="font-semibold text-foreground">[{sinTrabajar ? `${formatInt(Math.ceil(diasSinCotizar / 7))} sem / ${sinTrabajar.anos}a ${sinTrabajar.meses}m ${sinTrabajar.diasRestantes}d` : "—"}]</span>, por eso si vas a IMSS y pides tu pensión ahorita, te dirían &quot;ahorita no se puede hasta que recuperes tus derechos&quot; por eso aquí lo que hacemos es agendarte una asesoría con nuestro experto en pensiones para entender si se puede recuperar tus derechos con modalidad 40, o tiene que ser con modalidad 10, que nos diga cuanto tiempo hay que cotizar para recuperar derechos y todo lo que se tiene que hacer para que alcances la mejor pensión para tu caso en específico…</p>
                              <p className="text-wv-cyan italic">¿para ti sería viable que revisara si pudiera agendarte esta asesoría con nuestro experto?</p>
                            </div>
                          </div>
                        )}

                        {actMinAcredita && !acreditaAhora && !acreditaFuturo && !acreditaRecuperacion && escenarios && (
                          <div className="space-y-5">
                            <p className="text-sm sm:text-base font-bold text-foreground underline">Actualización de Pensión Mínima</p>
                            <div className="space-y-3 text-foreground/90">
                              <p>perfecto, pues mira, en tu caso, por la cantidad de semanas que tienes con tu promedio salarial actual, si te pensiones ahora, alcanzarías la pensión mínima, muchas veces con modalidad 40 se puede elevar tu, normalmente cuando se tiene debajo de <span className="font-semibold text-foreground">[{formatInt(semanasMinimas)}]</span> semanas, no conviene hacer la inversión en modalidad 40 porque sube muy poco la pensión pero si les conviene cotizar porque en lugar de pensionarse con la pensión mínima del año en el que dejar de cotizar, reciben la pensión mínima pero de este año y hay gente que les llega a aumentar 2 o 4 mil pesos extra al mes solo por esto, por eso… aquí lo que hacemos es agendarte una asesoría con nuestro experto en pensiones para saber si te conviene elevar tu pensión con modalidad 40 o actualizar tu pensión a la nueva pensión mínima de este año, ¿para ti sería viable que revisara si pudiera agendarte esta asesoría con nuestro experto?</p>
                            </div>
                          </div>
                        )}

                        {comp500Acredita && !acreditaAhora && !acreditaFuturo && !acreditaRecuperacion && !actMinAcredita && (
                          <div className="space-y-5">
                            <p className="text-sm sm:text-base font-bold text-foreground underline">Completar 500 Semanas</p>
                            <div className="space-y-3 text-foreground/90">
                              <p>perfecto, pues mira, en casos como los tuyos que tienen menos de 500 semanas cotizadas, lo que hacemos es financiar su modalidad 40 o modalidad 10, dependiendo su caso, para alcanzar las 500 semanas y ayudarlos a pensionarse con lo más que se pueda, en la mayoría de los casos es alcanzar la pensión mínima pero por lo menos ya empiezan a recibir <span className="font-semibold text-foreground">[{formatMXN(pensionMinimaVigente)}]</span> pesos mes con mes sin que les cueste de su dinero en este momento, si te parece podría agendarte una asesoría con nuestro experto en pensiones para que revise tu caso en especifico y te explique como se haría todo este proceso, ¿te gustaría que te agende una asesoría con nuestro experto para ver esto?</p>
                            </div>
                          </div>
                        )}
                      </div>
                      </div>
                      )}
                    </DetailToggle>
                  </section>
                )}

                {/* Datos de Asesoría — collapsible */}
                <section className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                  <DetailToggle label="Datos de Asesoría" defaultOpen={false} section>
                    <div className="px-4 sm:px-5 space-y-4">
                      <section>
                        <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                          <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                          <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">Métricas del Expediente</h2>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                          <MetricCard label="Semanas Cotizadas" value={formatInt(semanasTotales)} sub={result.header.semanasDescontadas > 0 ? `Cotizadas: ${formatInt(result.header.totalSemanasCotizadas)} | Desc: ${formatInt(result.header.semanasDescontadas)} | Reint: ${formatInt(result.header.semanasReintegradas)}` : `${formatInt(result.header.totalSemanasCotizadas)} cotizadas`} />
                          <MetricCard label="Promedio Salarial" value={formatMXN(result.salaryAverage.promedio)} sub={`${formatMXN(result.salaryAverage.promedio * 30.4)} mensual`} />
                          {edadExacta && <MetricCard label="Edad Actual" value={`${edadExacta.anos} años`} sub={`${edadExacta.anos} años, ${edadExacta.meses} meses, ${edadExacta.dias} días`} />}
                        </div>
                      </section>
                      {pensionResult && (
                        <section>
                          <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                            <div className="h-4 w-1 rounded-full bg-wv-green" />
                            <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">Mi Pensión Pronta</h2>
                          </div>
                          <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                            <div className="border-l-4 border-l-wv-green px-4 sm:px-5 py-4 sm:py-5 space-y-4">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">Pensión desde</p>
                                  <p className="text-2xl sm:text-3xl font-bold font-mono text-wv-green mt-1">{formatMesAno(pensionResult.mesPension)}</p>
                                </div>
                                {mesesRetroactivo !== null && mesesRetroactivo > 0 && (
                                  <div className="text-right">
                                    <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">Meses en retroactivo</p>
                                    <p className="text-2xl sm:text-3xl font-bold font-mono text-wv-cyan mt-1">{mesesRetroactivo}</p>
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className={`rounded-lg p-2.5 border ${pensionResult.cumple60 ? "bg-wv-green/5 border-wv-green/20" : "bg-wv-red/5 border-wv-red/20"}`}>
                                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cumple 60 años</p>
                                  <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${pensionResult.cumple60 ? "text-wv-green" : "text-wv-red"}`}>
                                    {pensionResult.cumple60 ? "Sí" : "No"}
                                    {!pensionResult.cumple60 && pensionResult.fecha60 && <span className="text-muted-foreground font-normal text-[10px]"> — cumple el {pensionResult.fecha60.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}</span>}
                                  </p>
                                </div>
                                <div className={`rounded-lg p-2.5 border ${pensionResult.pasaron6Meses ? "bg-wv-green/5 border-wv-green/20" : "bg-wv-red/5 border-wv-red/20"}`}>
                                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">6 meses conservación</p>
                                  <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${pensionResult.pasaron6Meses ? "text-wv-green" : "text-wv-red"}`}>
                                    {pensionResult.pasaron6Meses ? "Sí" : "No"}
                                    {!pensionResult.pasaron6Meses && <span className="text-muted-foreground font-normal text-[10px]"> — {pensionResult.fecha6Meses.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}</span>}
                                  </p>
                                </div>
                                <div className="rounded-lg p-2.5 border border-wv-border bg-muted/30">
                                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Última cotización</p>
                                  <p className="text-xs sm:text-sm font-semibold mt-0.5">{ultimaCotizacion?.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}</p>
                                </div>
                                <div className="rounded-lg p-2.5 border border-wv-border bg-muted/30">
                                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Regla día 15</p>
                                  <p className="text-xs sm:text-sm font-semibold mt-0.5 text-muted-foreground">{pensionResult.razon.includes("hoy") ? "Aplicada a hoy" : "Aplicada a fecha futura"}</p>
                                </div>
                              </div>
                              <p className="text-[10px] sm:text-[11px] text-muted-foreground italic">{pensionResult.razon}</p>
                            </div>
                          </div>
                        </section>
                      )}
                      {escenarios && (
                        <section>
                          <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                            <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                            <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">Escenarios de Pensión</h2>
                            <span className="text-[9px] sm:text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">Mod 40 Retroactivo</span>
                          </div>
                          <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                            <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-4">
                              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                                <label className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground cursor-pointer">
                                  <input type="checkbox" checked={esposa} onChange={(e) => setEsposa(e.target.checked)} className="rounded border-wv-border" />
                                  Esposa/concubina
                                </label>
                                <label className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                                  Hijos
                                  <select value={hijos} onChange={(e) => setHijos(Number(e.target.value))} className="rounded border border-wv-border bg-background px-1.5 py-0.5 text-[10px] sm:text-xs font-mono">
                                    {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                                  </select>
                                </label>
                                <span className="text-[9px] sm:text-[10px] text-muted-foreground">SBC Mod 40: {formatMXN(escenarios.mod40Salary)} diario (25 UMA)</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="rounded-xl border-2 border-wv-border bg-muted/20 p-4">
                                  <div className="text-center">
                                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pensión Actual</p>
                                    <p className="text-xl sm:text-2xl font-bold font-mono mt-1">{formatMXN(escenarios.pensionActual.pensionNeta)}</p>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">mensual neta</p>
                                  </div>
                                  <PensionSteps result={escenarios.pensionActual} label="Actual" />
                                </div>
                                <div className="rounded-xl border-2 border-wv-green/40 bg-wv-green/5 p-4">
                                  <div className="text-center">
                                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pensión Pronta</p>
                                    {pensionResult && <p className="text-[9px] sm:text-[10px] text-wv-green/70 font-medium">{formatMesAno(pensionResult.mesPension)}</p>}
                                    <p className="text-xl sm:text-2xl font-bold font-mono mt-1 text-wv-green">{formatMXN(escenarios.pensionPronta.pensionNeta)}</p>
                                    <p className="text-xs sm:text-sm font-semibold text-wv-green mt-1">+{formatMXN(escenarios.incremento1)}</p>
                                    <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">Prom: {formatMXN(escenarios.promedioE1)} · {Math.round(escenarios.mod40WeeksE1)} sem M40</p>
                                  </div>
                                  <PensionSteps result={escenarios.pensionPronta} label="Pronta" />
                                </div>
                                <div className="rounded-xl border-2 border-wv-cyan/40 bg-wv-cyan/5 p-4">
                                  <div className="text-center">
                                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pensión +6 Meses</p>
                                    {pensionResult && <p className="text-[9px] sm:text-[10px] text-wv-cyan/70 font-medium">{formatMesAno(addMonths(pensionResult.mesPension, 6))}</p>}
                                    <p className="text-xl sm:text-2xl font-bold font-mono mt-1 text-wv-cyan">{formatMXN(escenarios.pension6Meses.pensionNeta)}</p>
                                    <p className="text-xs sm:text-sm font-semibold text-wv-cyan mt-1">+{formatMXN(escenarios.incremento2)}</p>
                                    <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">Prom: {formatMXN(escenarios.promedioE2)} · {Math.round(escenarios.mod40WeeksE2)} sem M40</p>
                                  </div>
                                  <PensionSteps result={escenarios.pension6Meses} label="+6 Meses" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </section>
                      )}
                    </div>
                  </DetailToggle>
                </section>

                <section className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                  <DetailToggle label="Promedio Salarial" defaultOpen={false} section>
                    <div className="px-4 sm:px-5">
                    <SalaryAverageBreakdown
                      promedio={result.salaryAverage.promedio}
                      periods={result.salaryAverage.periods}
                    />
                    </div>
                  </DetailToggle>
                </section>

                {result.records.length > 0 && (
                  <section className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                    <DetailToggle label="Historial Laboral" defaultOpen={false} section>
                      <div className="px-4 sm:px-5">
                      <EmploymentTimeline records={result.records} />
                      </div>
                    </DetailToggle>
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

          </div>
        )}
      </div>
    </main>
  );
}

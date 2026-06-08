import { EmploymentRecord, RetiroParcial, RetirosDesempleoResult } from "./types";

const DIAS_MINIMOS_DESEMPLEO = 46;
const DIAS_RETIRO = 30;
const LEY97_INICIO = Date.UTC(1997, 6, 1); // July 1, 1997

// SMG diario Zona A (1997–2016), UMA diario (2017+)
const UMA_DIARIO_POR_AÑO: Record<number, number> = {
  1997: 26.45,
  1998: 30.20,
  1999: 34.45,
  2000: 37.90,
  2001: 40.35,
  2002: 42.15,
  2003: 43.65,
  2004: 45.24,
  2005: 46.80,
  2006: 48.67,
  2007: 50.57,
  2008: 52.59,
  2009: 54.80,
  2010: 57.46,
  2011: 59.82,
  2012: 62.33,
  2013: 64.76,
  2014: 67.29,
  2015: 70.10,
  2016: 73.04,
  2017: 75.49,
  2018: 80.60,
  2019: 84.49,
  2020: 86.88,
  2021: 89.62,
  2022: 96.22,
  2023: 103.74,
  2024: 108.57,
  2025: 113.14,
  2026: 117.65,
};

function getUMA(year: number): number {
  if (year in UMA_DIARIO_POR_AÑO) return UMA_DIARIO_POR_AÑO[year];
  if (year < 1997) return UMA_DIARIO_POR_AÑO[1997];
  return UMA_DIARIO_POR_AÑO[2026];
}

function topeUMAMensual(year: number): number {
  return 10 * getUMA(year) * 30.4;
}

interface MergedPeriod {
  inicio: Date;
  fin: Date;
  ultimoSalario: number;
}

function mergeEmploymentPeriods(records: EmploymentRecord[]): MergedPeriod[] {
  if (records.length === 0) return [];

  const sorted = [...records].sort(
    (a, b) => a.fechaAlta.getTime() - b.fechaAlta.getTime()
  );

  const merged: MergedPeriod[] = [];
  let current: MergedPeriod = {
    inicio: sorted[0].fechaAlta,
    fin: sorted[0].fechaBaja,
    ultimoSalario: sorted[0].salarioBaseCotizacion,
  };

  for (let i = 1; i < sorted.length; i++) {
    const r = sorted[i];
    if (r.fechaAlta.getTime() <= current.fin.getTime()) {
      if (r.fechaBaja.getTime() > current.fin.getTime()) {
        current.fin = r.fechaBaja;
        current.ultimoSalario = r.salarioBaseCotizacion;
      } else if (r.fechaBaja.getTime() === current.fin.getTime()) {
        current.ultimoSalario = Math.max(current.ultimoSalario, r.salarioBaseCotizacion);
      }
    } else {
      merged.push(current);
      current = {
        inicio: r.fechaAlta,
        fin: r.fechaBaja,
        ultimoSalario: r.salarioBaseCotizacion,
      };
    }
  }
  merged.push(current);

  return merged;
}

function buildRetiro(
  baja: Date,
  reingreso: Date,
  salario: number,
): RetiroParcial | null {
  const diasDesempleo = Math.floor(
    (reingreso.getTime() - baja.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diasDesempleo < DIAS_MINIMOS_DESEMPLEO) return null;
  if (baja.getTime() < LEY97_INICIO) return null;

  const year = baja.getUTCFullYear();
  const umaDiario = getUMA(year);
  const topeMensual = 10 * umaDiario * 30.4;
  const montoCalculado = DIAS_RETIRO * salario;
  const topeAplicado = montoCalculado > topeMensual;
  const montoRetiro = Math.min(montoCalculado, topeMensual);

  return {
    fechaBaja: baja,
    fechaReingreso: reingreso,
    diasDesempleo,
    salarioDiario: salario,
    montoRetiro,
    topeAplicado,
    umaDiario,
    topeMensual,
  };
}

export function calculateRetirosDesempleo(
  records: EmploymentRecord[]
): RetirosDesempleoResult {
  const merged = mergeEmploymentPeriods(records);
  const retiros: RetiroParcial[] = [];

  for (let i = 0; i < merged.length - 1; i++) {
    const retiro = buildRetiro(
      merged[i].fin,
      merged[i + 1].inicio,
      merged[i].ultimoSalario,
    );
    if (retiro) retiros.push(retiro);
  }

  if (merged.length > 0) {
    const last = merged[merged.length - 1];
    const hoy = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
      )
    );
    const retiro = buildRetiro(last.fin, hoy, last.ultimoSalario);
    if (retiro) retiros.push(retiro);
  }

  return {
    retiros,
    totalDevolver: retiros.reduce((sum, r) => sum + r.montoRetiro, 0),
  };
}

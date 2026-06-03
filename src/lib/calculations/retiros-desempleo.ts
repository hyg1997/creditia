import { EmploymentRecord, RetiroParcial, RetirosDesempleoResult } from "./types";

const DIAS_MINIMOS_DESEMPLEO = 46;
const DIAS_RETIRO = 30;

const UMA_DIARIO_POR_AÑO: Record<number, number> = {
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
  if (year < 2017) return 75.49;
  return UMA_DIARIO_POR_AÑO[2026] ?? 117.65;
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

export function calculateRetirosDesempleo(
  records: EmploymentRecord[]
): RetirosDesempleoResult {
  const merged = mergeEmploymentPeriods(records);
  const retiros: RetiroParcial[] = [];

  for (let i = 0; i < merged.length - 1; i++) {
    const baja = merged[i].fin;
    const reingreso = merged[i + 1].inicio;
    const diasDesempleo = Math.floor(
      (reingreso.getTime() - baja.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diasDesempleo < DIAS_MINIMOS_DESEMPLEO) continue;

    const salario = merged[i].ultimoSalario;
    const year = baja.getUTCFullYear();
    const tope = topeUMAMensual(year);
    const montoCalculado = DIAS_RETIRO * salario;
    const topeAplicado = montoCalculado > tope;
    const montoRetiro = Math.min(montoCalculado, tope);

    retiros.push({
      fechaBaja: baja,
      fechaReingreso: reingreso,
      diasDesempleo,
      salarioDiario: salario,
      montoRetiro,
      topeAplicado,
    });
  }

  return {
    retiros,
    totalDevolver: retiros.reduce((sum, r) => sum + r.montoRetiro, 0),
  };
}

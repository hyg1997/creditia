import { SalaryPeriod, SalaryAverageResult } from "./types";

const WEEKS_TO_AVERAGE = 250;

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Resolves overlapping salary periods (empalmes).
 * When two periods overlap in time, splits them into sub-periods
 * and sums the salaries during the overlap.
 */
function resolveOverlaps(periods: SalaryPeriod[]): SalaryPeriod[] {
  if (periods.length <= 1) return periods;

  const DAY_MS = 24 * 60 * 60 * 1000;

  // Use exclusive-end boundaries to properly split overlapping periods.
  // Each period [start, end] becomes [start, end+1day) in boundary math.
  // This ensures: [A.start, B.start-1] [B.start, B.end] [B.end+1, A.end]
  const boundaries = new Set<number>();
  for (const p of periods) {
    boundaries.add(p.fechaInicio.getTime());
    boundaries.add(p.fechaFin.getTime() + DAY_MS);
  }
  const sortedBounds = Array.from(boundaries).sort((a, b) => a - b);

  const result: SalaryPeriod[] = [];
  for (let i = 0; i < sortedBounds.length - 1; i++) {
    const start = sortedBounds[i];
    const endExcl = sortedBounds[i + 1];
    const endIncl = endExcl - DAY_MS;

    if (endIncl < start) continue;

    let totalSalary = 0;
    let hasActive = false;
    for (const p of periods) {
      const pStart = p.fechaInicio.getTime();
      const pEndIncl = p.fechaFin.getTime();
      if (pStart <= start && pEndIncl >= endIncl) {
        totalSalary += p.salarioDiario;
        hasActive = true;
      }
    }

    if (hasActive) {
      result.push({
        fechaInicio: new Date(start),
        fechaFin: new Date(endIncl),
        salarioDiario: totalSalary,
      });
    }
  }

  return result;
}

/**
 * Calcula el promedio salarial de las últimas 250 semanas cotizadas.
 *
 * Uses original movement dates. The day count is:
 * - First period (most recent, ends with BAJA): (end - start + 1) days
 *   because the BAJA date is the last day worked (inclusive).
 * - All other periods: (end - start) days
 *   because the end date is the start of the next period (exclusive boundary).
 */
export function calculateSalaryAverage(
  salaryPeriods: SalaryPeriod[]
): SalaryAverageResult {
  const resolved = resolveOverlaps(salaryPeriods);

  // Sort by fechaInicio DESC (most recent first)
  const sorted = [...resolved].sort(
    (a, b) => b.fechaInicio.getTime() - a.fechaInicio.getTime()
  );

  let accumulatedWeeks = 0;
  const periods: SalaryAverageResult["periods"] = [];

  for (let i = 0; i < sorted.length; i++) {
    const sp = sorted[i];
    // First period: BAJA date is inclusive (+1 day)
    // Other periods: end date is exclusive (start of next period)
    const dias = daysBetween(sp.fechaInicio, sp.fechaFin) + (i === 0 ? 1 : 0);
    const semanasTotales = dias / 7;

    if (accumulatedWeeks >= WEEKS_TO_AVERAGE) {
      periods.push({
        fechaAlta: sp.fechaInicio,
        fechaBaja: sp.fechaFin,
        salarioDiario: sp.salarioDiario,
        dias,
        semanasTotales,
        semanasContadas: 0,
        resultado: 0,
      });
      continue;
    }

    let semanasContadas: number;
    if (accumulatedWeeks + semanasTotales > WEEKS_TO_AVERAGE) {
      semanasContadas = WEEKS_TO_AVERAGE - accumulatedWeeks;
    } else {
      semanasContadas = semanasTotales;
    }

    const resultado = semanasContadas > 0
      ? semanasContadas * sp.salarioDiario
      : 0;

    accumulatedWeeks += semanasContadas;

    periods.push({
      fechaAlta: sp.fechaInicio,
      fechaBaja: sp.fechaFin,
      salarioDiario: sp.salarioDiario,
      dias,
      semanasTotales,
      semanasContadas,
      resultado,
    });
  }

  const totalResultado = periods.reduce((sum, p) => sum + p.resultado, 0);
  const promedio = WEEKS_TO_AVERAGE > 0 ? totalResultado / WEEKS_TO_AVERAGE : 0;

  return { promedio, periods };
}

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
 *
 * Example: Employee works at Company A ($233) from Aug 10-Sep 1
 * and Company B ($227) from Aug 17-Dec 2:
 *   → Aug 10-17: $233 (only A)
 *   → Aug 17-Sep 1: $460 (A + B)
 *   → Sep 1-Dec 2: $227 (only B)
 */
function resolveOverlaps(periods: SalaryPeriod[]): SalaryPeriod[] {
  if (periods.length <= 1) return periods;

  // Collect all unique time boundaries
  const boundaries = new Set<number>();
  for (const p of periods) {
    boundaries.add(p.fechaInicio.getTime());
    boundaries.add(p.fechaFin.getTime());
  }
  const sorted = Array.from(boundaries).sort((a, b) => a - b);

  // For each sub-interval, sum salaries of all covering periods
  const result: SalaryPeriod[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];

    let totalSalary = 0;
    let hasActive = false;
    for (const p of periods) {
      const pStart = p.fechaInicio.getTime();
      const pEnd = p.fechaFin.getTime();
      if (pStart <= start && pEnd >= end) {
        totalSalary += p.salarioDiario;
        hasActive = true;
      }
    }

    if (hasActive) {
      result.push({
        fechaInicio: new Date(start),
        fechaFin: new Date(end),
        salarioDiario: totalSalary,
      });
    }
  }

  return result;
}

/**
 * Calcula el promedio salarial de las últimas 250 semanas cotizadas.
 *
 * 1. Resolve overlapping employment periods (empalmes) by summing salaries
 * 2. Sort periods by date DESC (most recent first)
 * 3. Accumulate weeks until 250, capping the last period if needed
 * 4. Average = SUM(salary × weeks_counted) / 250
 */
export function calculateSalaryAverage(
  salaryPeriods: SalaryPeriod[]
): SalaryAverageResult {
  // Resolve overlaps before calculating average
  const resolved = resolveOverlaps(salaryPeriods);

  // Sort by fechaInicio DESC (most recent first)
  const sorted = [...resolved].sort(
    (a, b) => b.fechaInicio.getTime() - a.fechaInicio.getTime()
  );

  let accumulatedWeeks = 0;
  const periods: SalaryAverageResult["periods"] = [];

  for (const sp of sorted) {
    const dias = daysBetween(sp.fechaInicio, sp.fechaFin);
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

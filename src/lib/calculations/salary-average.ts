import { SalaryPeriod, SalaryAverageResult } from "./types";

const WEEKS_TO_AVERAGE = 250;

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Calcula el promedio salarial de las últimas 250 semanas cotizadas.
 *
 * Usa los periodos salariales derivados de los movimientos, lo cual
 * permite considerar cambios de salario por MODIFICACION DE SALARIO.
 */
export function calculateSalaryAverage(
  salaryPeriods: SalaryPeriod[]
): SalaryAverageResult {
  // Sort by fechaInicio DESC (most recent first)
  const sorted = [...salaryPeriods].sort(
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

import { EmploymentRecord, SalaryAverageResult } from "./types";

const WEEKS_TO_AVERAGE = 250;

function daysBetweenInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Calcula el promedio salarial de las últimas 250 semanas cotizadas.
 *
 * Algoritmo:
 * 1. Ordena registros por fecha_alta DESC (más reciente primero)
 * 2. Para cada periodo: semanas = días_inclusivos / 7
 * 3. Acumula semanas hasta 250, capeando el último periodo si excede
 * 4. Promedio = SUM(salario * semanas_capeadas) / 250
 */
export function calculateSalaryAverage(
  records: EmploymentRecord[]
): SalaryAverageResult {
  // Sort by fecha_alta DESC (most recent first)
  const sorted = [...records].sort(
    (a, b) => b.fechaAlta.getTime() - a.fechaAlta.getTime()
  );

  let accumulatedWeeks = 0;
  const periods: SalaryAverageResult["periods"] = [];

  for (const record of sorted) {
    if (accumulatedWeeks >= WEEKS_TO_AVERAGE) {
      // Already have 250 weeks, add remaining with 0 counted weeks
      const dias = daysBetweenInclusive(record.fechaAlta, record.fechaBaja);
      const semanasTotales = dias / 7;
      periods.push({
        fechaAlta: record.fechaAlta,
        fechaBaja: record.fechaBaja,
        salarioDiario: record.salarioBaseCotizacion,
        dias,
        semanasTotales,
        semanasContadas: 0,
        resultado: 0,
      });
      continue;
    }

    const dias = daysBetweenInclusive(record.fechaAlta, record.fechaBaja);
    const semanasTotales = dias / 7;

    let semanasContadas: number;
    if (accumulatedWeeks + semanasTotales > WEEKS_TO_AVERAGE) {
      // Cap this period to reach exactly 250
      semanasContadas = WEEKS_TO_AVERAGE - accumulatedWeeks;
    } else {
      semanasContadas = semanasTotales;
    }

    const resultado = semanasContadas > 0
      ? semanasContadas * record.salarioBaseCotizacion
      : 0;

    accumulatedWeeks += semanasContadas;

    periods.push({
      fechaAlta: record.fechaAlta,
      fechaBaja: record.fechaBaja,
      salarioDiario: record.salarioBaseCotizacion,
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

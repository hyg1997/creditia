import { EmploymentRecord, PeriodAfore, AforeResult } from "./types";

const CURRENT_YEAR = 2026;
const RENDIMIENTO_RATE = 0.1048;
const SAR_RATE = 0.02;
const RCV_TRABAJADOR_RATE = 0.01125;
const RCV_PATRON_RATE = 0.0315;
const VIVIENDA_RATE = 0.05;

function daysBetweenInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Calcula el saldo AFORE para cada periodo laboral.
 *
 * Fórmulas exactas del Excel:
 * - SAR 92: year < 1998 → total_salario * 0.02
 * - SAR 97: year > 1997 → total_salario * 0.02
 * - RCV Trabajador: year > 1997 → total_salario * 0.01125
 * - RCV Patrón: year > 1997 → total_salario * 0.0315
 * - Vivienda 92: year < 1998 → total_salario * 0.05
 * - Vivienda 97: year > 1997 → total_salario * 0.05
 *
 * Rendimientos:
 * - SAR 92, SAR 97, RCV: IF(year > 1996) → (2026 - year) * 0.1048 * aportación
 * - Vivienda 92, Vivienda 97: siempre → (2026 - year) * 0.1048 * aportación
 *
 * Saldo Final AFORE (sin RCV):
 * = (SAR92 + rend) + (SAR97 + rend) + (Vivienda92 + rend) + (Vivienda97 + rend)
 */
export function calculateAfore(records: EmploymentRecord[]): AforeResult {
  const periods: PeriodAfore[] = records.map((record) => {
    const year = record.fechaAlta.getFullYear();
    const dias = daysBetweenInclusive(record.fechaAlta, record.fechaBaja);
    const totalSalario = dias * record.salarioBaseCotizacion;
    const yearsElapsed = CURRENT_YEAR - year;

    // Contributions
    const sar92 = year < 1998 ? totalSalario * SAR_RATE : 0;
    const sar97 = year > 1997 ? totalSalario * SAR_RATE : 0;
    const rcvTrabajador = year > 1997 ? totalSalario * RCV_TRABAJADOR_RATE : 0;
    const rcvPatron = year > 1997 ? totalSalario * RCV_PATRON_RATE : 0;
    const vivienda92 = year < 1998 ? totalSalario * VIVIENDA_RATE : 0;
    const vivienda97 = year > 1997 ? totalSalario * VIVIENDA_RATE : 0;

    // Rendimientos - SAR/RCV only when year > 1996, Vivienda always
    const rendimientoFactor = yearsElapsed * RENDIMIENTO_RATE;
    const rendCondition = year > 1996;

    const sar92Rendimientos = rendCondition ? rendimientoFactor * sar92 : 0;
    const sar97Rendimientos = rendCondition ? rendimientoFactor * sar97 : 0;
    const rcvTrabajadorRendimientos = rendCondition
      ? rendimientoFactor * rcvTrabajador
      : 0;
    const rcvPatronRendimientos = rendCondition
      ? rendimientoFactor * rcvPatron
      : 0;
    // Vivienda rendimientos: always calculated (no year condition)
    const vivienda92Rendimientos = rendimientoFactor * vivienda92;
    const vivienda97Rendimientos = rendimientoFactor * vivienda97;

    return {
      year,
      salarioDiario: record.salarioBaseCotizacion,
      dias,
      totalSalario,
      sar92,
      sar92Rendimientos,
      sar97,
      sar97Rendimientos,
      rcvTrabajador,
      rcvTrabajadorRendimientos,
      rcvPatron,
      rcvPatronRendimientos,
      vivienda92,
      vivienda92Rendimientos,
      vivienda97,
      vivienda97Rendimientos,
    };
  });

  // Sum totals
  const totals = periods.reduce(
    (acc, p) => ({
      sar92: acc.sar92 + p.sar92,
      sar92Rendimientos: acc.sar92Rendimientos + p.sar92Rendimientos,
      sar97: acc.sar97 + p.sar97,
      sar97Rendimientos: acc.sar97Rendimientos + p.sar97Rendimientos,
      rcvTrabajador: acc.rcvTrabajador + p.rcvTrabajador,
      rcvTrabajadorRendimientos:
        acc.rcvTrabajadorRendimientos + p.rcvTrabajadorRendimientos,
      rcvPatron: acc.rcvPatron + p.rcvPatron,
      rcvPatronRendimientos:
        acc.rcvPatronRendimientos + p.rcvPatronRendimientos,
      vivienda92: acc.vivienda92 + p.vivienda92,
      vivienda92Rendimientos:
        acc.vivienda92Rendimientos + p.vivienda92Rendimientos,
      vivienda97: acc.vivienda97 + p.vivienda97,
      vivienda97Rendimientos:
        acc.vivienda97Rendimientos + p.vivienda97Rendimientos,
    }),
    {
      sar92: 0,
      sar92Rendimientos: 0,
      sar97: 0,
      sar97Rendimientos: 0,
      rcvTrabajador: 0,
      rcvTrabajadorRendimientos: 0,
      rcvPatron: 0,
      rcvPatronRendimientos: 0,
      vivienda92: 0,
      vivienda92Rendimientos: 0,
      vivienda97: 0,
      vivienda97Rendimientos: 0,
    }
  );

  // Saldo AFORE = (SAR92+rend) + (SAR97+rend) + (Viv92+rend) + (Viv97+rend)
  const saldoAfore =
    totals.sar92 +
    totals.sar92Rendimientos +
    totals.sar97 +
    totals.sar97Rendimientos +
    totals.vivienda92 +
    totals.vivienda92Rendimientos +
    totals.vivienda97 +
    totals.vivienda97Rendimientos;

  // RCV total (separate)
  const saldoRCV =
    totals.rcvTrabajador +
    totals.rcvTrabajadorRendimientos +
    totals.rcvPatron +
    totals.rcvPatronRendimientos;

  return { periods, totals, saldoAfore, saldoRCV };
}

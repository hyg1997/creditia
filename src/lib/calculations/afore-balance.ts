import { SalaryPeriod, PeriodAfore, AforeResult, SubcuentaTotal } from "./types";

// Índice de precios acumulado (base 1991=1.00) derivado de inflación anual INPC (INEGI).
// Se usa para deflactar salarios en periodos largos donde solo conocemos el SBC final.
const INPC_INDEX: Record<number, number> = {
  1992: 1.12, 1993: 1.21, 1994: 1.29, 1995: 1.97, 1996: 2.51,
  1997: 2.91, 1998: 3.45, 1999: 3.87, 2000: 4.22, 2001: 4.41,
  2002: 4.66, 2003: 4.84, 2004: 5.09, 2005: 5.26, 2006: 5.48,
  2007: 5.68, 2008: 6.05, 2009: 6.27, 2010: 6.55, 2011: 6.80,
  2012: 7.04, 2013: 7.32, 2014: 7.62, 2015: 7.78, 2016: 8.04,
  2017: 8.58, 2018: 9.00, 2019: 9.25, 2020: 9.54, 2021: 10.25,
  2022: 11.05, 2023: 11.57, 2024: 12.05, 2025: 12.51, 2026: 12.95,
};

function getINPC(year: number): number {
  if (year in INPC_INDEX) return INPC_INDEX[year];
  if (year < 1992) return INPC_INDEX[1992];
  return INPC_INDEX[2026];
}

function expandPeriods(periods: SalaryPeriod[]): SalaryPeriod[] {
  const expanded: SalaryPeriod[] = [];

  for (const sp of periods) {
    const startYear = sp.fechaInicio.getUTCFullYear();
    const endYear = sp.fechaFin.getUTCFullYear();

    if (startYear === endYear) {
      expanded.push(sp);
      continue;
    }

    const refINPC = getINPC(endYear);

    for (let y = startYear; y <= endYear; y++) {
      const subStart = y === startYear
        ? sp.fechaInicio
        : new Date(Date.UTC(y, 0, 1));
      const subEnd = y === endYear
        ? sp.fechaFin
        : new Date(Date.UTC(y, 11, 31));

      expanded.push({
        fechaInicio: subStart,
        fechaFin: subEnd,
        salarioDiario: sp.salarioDiario * (getINPC(y) / refINPC),
      });
    }
  }

  return expanded;
}

const RENDIMIENTO_NETO_ANUAL: Record<number, number> = {
  1992: 0.14,
  1993: 0.09,
  1994: 0.28,
  1995: 0.43,
  1996: 0.24,
  1997: 0.16,
  1998: 0.20,
  1999: 0.18,
  2000: 0.12,
  2001: 0.10,
  2002: 0.06,
  2003: 0.07,
  2004: 0.06,
  2005: 0.08,
  2006: 0.10,
  2007: 0.05,
  2008: -0.06,
  2009: 0.12,
  2010: 0.11,
  2011: 0.05,
  2012: 0.12,
  2013: 0.02,
  2014: 0.08,
  2015: 0.03,
  2016: 0.05,
  2017: 0.08,
  2018: 0.00,
  2019: 0.09,
  2020: 0.05,
  2021: 0.06,
  2022: 0.03,
  2023: 0.10,
  2024: 0.14,
  2025: 0.09,
};

const FALLBACK_RATE = 0.06;

function getRate(year: number): number {
  return RENDIMIENTO_NETO_ANUAL[year] ?? FALLBACK_RATE;
}

// Rendimientos INFONAVIT (subcuenta de vivienda) — tasas nominales anuales.
// Pre-1997: vivienda SAR administrada por INFONAVIT, rendimientos ~INPC (inflación).
// 1997-2003: transición, rendimiento cercano al aumento del salario mínimo.
// 2004+: INFONAVIT publica rendimiento propio (fuente: Informes Anuales INFONAVIT).
// Tasas confirmadas marcadas; las demás son estimaciones basadas en aumentos de SM e INPC.
const RENDIMIENTO_INFONAVIT: Record<number, number> = {
  1992: 0.08, 1993: 0.07, 1994: 0.06, 1995: 0.35, 1996: 0.22,
  1997: 0.14,  1998: 0.12,  1999: 0.10,  2000: 0.08,
  2001: 0.065, 2002: 0.045, 2003: 0.036,
  2004: 0.0835, // confirmado
  2005: 0.035, 2006: 0.040, 2007: 0.039, 2008: 0.040,
  2009: 0.045, 2010: 0.050, 2011: 0.042,
  2012: 0.056, // INFONAVIT empezó a agregar +1.5% sobre SM
  2013: 0.063, 2014: 0.0651, 2015: 0.066,
  2016: 0.0681, // confirmado
  2017: 0.0832, // confirmado
  2018: 0.0638, // confirmado
  2019: 0.0732, // confirmado
  2020: 0.0533, // confirmado
  2021: 0.0736, // confirmado
  2022: 0.0782, // confirmado
  2023: 0.0633, // confirmado
  2024: 0.0698, // confirmado
  2025: 0.0500, // confirmado
};

const FALLBACK_INFONAVIT_RATE = 0.05;

function getInfonavitRate(year: number): number {
  return RENDIMIENTO_INFONAVIT[year] ?? FALLBACK_INFONAVIT_RATE;
}

const SAR_RATE = 0.02;
const VIVIENDA_RATE = 0.05;
const CEAV_TRABAJADOR_RATE = 0.01125;
const CEAV_PATRON_RATE = 0.0315;
const TOPE_UMA = 25;

function topeSBC(salarioDiario: number, year: number): number {
  return Math.min(salarioDiario, TOPE_UMA * getUMA(year));
}

// Salario Mínimo General del D.F. / CDMX (fuente: CONASAMI)
// Usado para cuota social pre-2009: 5.5% del SMGDF por día cotizado
const SMGDF_POR_AÑO: Record<number, number> = {
  1997: 26.45, 1998: 30.20, 1999: 34.45, 2000: 37.90,
  2001: 40.35, 2002: 42.15, 2003: 43.65, 2004: 45.24,
  2005: 46.80, 2006: 48.67, 2007: 50.57, 2008: 52.59,
};

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

// Pre-2009: cuota social = 5.5% del SMGDF (monto fijo, igual para todos)
// Post-2009: porcentaje del SBC según rango en UMAs (Art. 168 Fracc. IV LSS)
function calcCuotaSocialDiaria(salarioDiario: number, year: number): number {
  if (year < 1997) return 0;

  if (year < 2009) {
    const smgdf = SMGDF_POR_AÑO[year];
    if (!smgdf) return 0;
    return smgdf * 0.055;
  }

  const uma = getUMA(year);
  const umas = salarioDiario / uma;

  if (umas <= 1.0) return salarioDiario * 0.0377;
  if (umas <= 4.0) return salarioDiario * 0.0283;
  if (umas <= 7.0) return salarioDiario * 0.0189;
  if (umas <= 10.0) return salarioDiario * 0.0094;
  if (umas <= 15.0) return salarioDiario * 0.0;
  return 0;
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

function compoundRendimiento(aportacion: number, fromYear: number, toYear: number): number {
  if (aportacion <= 0 || fromYear >= toYear) return 0;
  let factor = 1;
  for (let y = fromYear; y < toYear; y++) {
    factor *= 1 + getRate(y);
  }
  return aportacion * (factor - 1);
}

function compoundRendimientoVivienda(aportacion: number, fromYear: number, toYear: number): number {
  if (aportacion <= 0 || fromYear >= toYear) return 0;
  let factor = 1;
  for (let y = fromYear; y < toYear; y++) {
    factor *= 1 + getInfonavitRate(y);
  }
  return aportacion * (factor - 1);
}

function emptySubcuenta(): SubcuentaTotal {
  return { aportaciones: 0, rendimientos: 0, total: 0 };
}

export function calculateAfore(salaryPeriods: SalaryPeriod[]): AforeResult {
  const currentYear = new Date().getUTCFullYear();
  const adjustedPeriods = expandPeriods(salaryPeriods);

  const periods: PeriodAfore[] = adjustedPeriods.map((sp) => {
    const year = sp.fechaInicio.getUTCFullYear();
    const dias = daysBetween(sp.fechaInicio, sp.fechaFin);
    const sbcTopado = topeSBC(sp.salarioDiario, year);
    const totalSalario = dias * sbcTopado;

    const isPre98 = year < 1998;
    const isPost97 = year > 1997;

    const cuotaSocialDiaria = isPost97 ? calcCuotaSocialDiaria(sbcTopado, year) : 0;

    return {
      year,
      salarioDiario: sbcTopado,
      dias,
      totalSalario,
      sar92: isPre98 ? totalSalario * SAR_RATE : 0,
      vivienda92: isPre98 ? totalSalario * VIVIENDA_RATE : 0,
      retiro: isPost97 ? totalSalario * SAR_RATE : 0,
      ceavTrabajador: isPost97 ? totalSalario * CEAV_TRABAJADOR_RATE : 0,
      ceavPatron: isPost97 ? totalSalario * CEAV_PATRON_RATE : 0,
      cuotaSocial: cuotaSocialDiaria * dias,
      vivienda97: isPost97 ? totalSalario * VIVIENDA_RATE : 0,
    };
  });

  const sar92 = emptySubcuenta();
  const vivienda92 = emptySubcuenta();
  const retiro = emptySubcuenta();
  const ceavTrabajador = emptySubcuenta();
  const ceavPatron = emptySubcuenta();
  const cuotaSocial = emptySubcuenta();
  const vivienda97 = emptySubcuenta();

  for (const p of periods) {
    sar92.aportaciones += p.sar92;
    sar92.rendimientos += compoundRendimiento(p.sar92, p.year, currentYear);

    vivienda92.aportaciones += p.vivienda92;
    vivienda92.rendimientos += compoundRendimientoVivienda(p.vivienda92, p.year, currentYear);

    retiro.aportaciones += p.retiro;
    retiro.rendimientos += compoundRendimiento(p.retiro, p.year, currentYear);

    ceavTrabajador.aportaciones += p.ceavTrabajador;
    ceavTrabajador.rendimientos += compoundRendimiento(p.ceavTrabajador, p.year, currentYear);

    ceavPatron.aportaciones += p.ceavPatron;
    ceavPatron.rendimientos += compoundRendimiento(p.ceavPatron, p.year, currentYear);

    cuotaSocial.aportaciones += p.cuotaSocial;
    cuotaSocial.rendimientos += compoundRendimiento(p.cuotaSocial, p.year, currentYear);

    vivienda97.aportaciones += p.vivienda97;
    vivienda97.rendimientos += compoundRendimientoVivienda(p.vivienda97, p.year, currentYear);
  }

  for (const s of [sar92, vivienda92, retiro, ceavTrabajador, ceavPatron, cuotaSocial, vivienda97]) {
    s.total = s.aportaciones + s.rendimientos;
  }

  const totalRCV = ceavTrabajador.total + ceavPatron.total + cuotaSocial.total;
  const totalSAR92 = sar92.total;
  const totalVivienda = vivienda92.total + vivienda97.total;
  const saldoTotal = totalSAR92 + retiro.total + totalRCV + totalVivienda;

  return {
    sar92,
    vivienda92,
    retiro,
    ceavTrabajador,
    ceavPatron,
    cuotaSocial,
    vivienda97,
    totalRCV,
    totalSAR92,
    totalVivienda,
    saldoTotal,
    periods,
  };
}

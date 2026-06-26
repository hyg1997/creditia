interface SalaryPeriodLite {
  salarioDiario: number;
  semanasTotales: number;
}

const UMA_BY_YEAR: Record<number, number> = {
  2016: 73.04, 2017: 75.49, 2018: 80.60, 2019: 84.49,
  2020: 86.88, 2021: 89.62, 2022: 96.22, 2023: 103.74,
  2024: 108.57, 2025: 113.14, 2026: 117.65, 2027: 121.74,
  2028: 126.00, 2029: 130.41, 2030: 134.97, 2031: 139.69,
};

const SMG_BY_YEAR: Record<number, number> = {
  2016: 73.04, 2017: 80.04, 2018: 88.36, 2019: 102.68,
  2020: 123.22, 2021: 141.70, 2022: 172.87, 2023: 207.44,
  2024: 248.93, 2025: 278.80, 2026: 315.04, 2027: 352.84,
  2028: 388.12, 2029: 426.93, 2030: 452.55, 2031: 478.35,
};

const CUANTIA_TABLE: { from: number; to: number; basica: number; incremento: number }[] = [
  { from: 0, to: 1, basica: 0.80, incremento: 0.00563 },
  { from: 1.01, to: 1.25, basica: 0.7711, incremento: 0.00814 },
  { from: 1.26, to: 1.50, basica: 0.5818, incremento: 0.01178 },
  { from: 1.51, to: 1.75, basica: 0.4923, incremento: 0.0143 },
  { from: 1.76, to: 2.00, basica: 0.4267, incremento: 0.01615 },
  { from: 2.01, to: 2.25, basica: 0.3765, incremento: 0.01756 },
  { from: 2.26, to: 2.50, basica: 0.3368, incremento: 0.01868 },
  { from: 2.51, to: 2.75, basica: 0.3048, incremento: 0.01958 },
  { from: 2.76, to: 3.00, basica: 0.2783, incremento: 0.02033 },
  { from: 3.01, to: 3.25, basica: 0.256, incremento: 0.02096 },
  { from: 3.26, to: 3.50, basica: 0.237, incremento: 0.02149 },
  { from: 3.51, to: 3.75, basica: 0.2207, incremento: 0.02195 },
  { from: 3.76, to: 4.00, basica: 0.2065, incremento: 0.02235 },
  { from: 4.01, to: 4.25, basica: 0.1939, incremento: 0.02271 },
  { from: 4.26, to: 4.50, basica: 0.1829, incremento: 0.02302 },
  { from: 4.51, to: 4.75, basica: 0.173, incremento: 0.0233 },
  { from: 4.76, to: 5.00, basica: 0.1641, incremento: 0.02355 },
  { from: 5.01, to: 5.25, basica: 0.1561, incremento: 0.02377 },
  { from: 5.26, to: 5.50, basica: 0.1488, incremento: 0.02398 },
  { from: 5.51, to: 5.75, basica: 0.1422, incremento: 0.02416 },
  { from: 5.76, to: 6.00, basica: 0.1362, incremento: 0.02433 },
  { from: 6.01, to: Infinity, basica: 0.13, incremento: 0.0245 },
];

const CESANTIA: Record<number, number> = {
  60: 0.75, 61: 0.80, 62: 0.85, 63: 0.90, 64: 0.95,
};

const ISR_BRACKETS = [
  { limiteInf: 0, limiteSup: 844.59, cuotaFija: 0, tasa: 0.0192 },
  { limiteInf: 844.60, limiteSup: 7168.51, cuotaFija: 16.22, tasa: 0.064 },
  { limiteInf: 7168.52, limiteSup: 12598.02, cuotaFija: 420.95, tasa: 0.1088 },
  { limiteInf: 12598.03, limiteSup: 14644.64, cuotaFija: 1011.68, tasa: 0.16 },
  { limiteInf: 14644.65, limiteSup: 17533.64, cuotaFija: 1339.14, tasa: 0.1792 },
  { limiteInf: 17533.65, limiteSup: 35362.83, cuotaFija: 1856.84, tasa: 0.2136 },
  { limiteInf: 35362.84, limiteSup: 55736.68, cuotaFija: 5665.16, tasa: 0.2352 },
  { limiteInf: 55736.69, limiteSup: 106410.50, cuotaFija: 10457.09, tasa: 0.30 },
  { limiteInf: 106410.51, limiteSup: 141880.66, cuotaFija: 25659.23, tasa: 0.32 },
  { limiteInf: 141880.67, limiteSup: 425641.99, cuotaFija: 37009.69, tasa: 0.34 },
  { limiteInf: 425642.00, limiteSup: Infinity, cuotaFija: 133488.54, tasa: 0.35 },
];

function getUMA(year: number, month: number): number {
  const lookupYear = month >= 2 ? year : year - 1;
  return UMA_BY_YEAR[lookupYear] ?? UMA_BY_YEAR[2026];
}

function getSMG(year: number): number {
  return SMG_BY_YEAR[year] ?? SMG_BY_YEAR[2026];
}

export function getPensionMinima(year?: number): number {
  const y = year ?? new Date().getUTCFullYear();
  const smg = getSMG(y);
  return smg * 365 / 12 * 1.11;
}

function lookupCuantia(salarioEnUMAs: number): { basica: number; incremento: number } {
  for (const row of CUANTIA_TABLE) {
    if (salarioEnUMAs <= row.to) return { basica: row.basica, incremento: row.incremento };
  }
  return CUANTIA_TABLE[CUANTIA_TABLE.length - 1];
}

function calcIncrementYears(totalWeeks: number): number {
  if (totalWeeks < 500) return 0;
  const excess = totalWeeks - 500;
  const fullYears = Math.trunc(excess / 52);
  const remainingWeeks = excess - fullYears * 52;
  let fraction = 0;
  if (remainingWeeks >= 26.1) fraction = 1;
  else if (remainingWeeks >= 13) fraction = 0.5;
  return fullYears + fraction;
}

function calcISR(pensionBruta: number, uma: number): number {
  const exencion = 15 * uma * 30.4;
  const baseGravable = Math.max(0, pensionBruta - exencion);
  if (baseGravable <= 0) return 0;

  let cuotaFija = 0;
  let tasa = 0;
  let limiteInf = 0;
  for (const bracket of ISR_BRACKETS) {
    if (baseGravable >= bracket.limiteInf) {
      cuotaFija = bracket.cuotaFija;
      tasa = bracket.tasa;
      limiteInf = bracket.limiteInf;
    }
  }
  return cuotaFija + (baseGravable - limiteInf) * tasa;
}

function ageAtDate(fechaNacimiento: Date, targetDate: Date): number {
  let years = targetDate.getUTCFullYear() - fechaNacimiento.getUTCFullYear();
  const monthDiff = targetDate.getUTCMonth() - fechaNacimiento.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && targetDate.getUTCDate() < fechaNacimiento.getUTCDate())) {
    years--;
  }
  return years;
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

interface PensionCalcInput {
  salarioPromedio: number;
  totalSemanas: number;
  edadRetiro: number;
  retirementDate: Date;
  esposa: boolean;
  hijos: number;
}

export interface PensionCalcResult {
  pensionBruta: number;
  isr: number;
  pensionNeta: number;
  steps: {
    salarioPromedio: number;
    totalSemanas: number;
    edadRetiro: number;
    uma: number;
    smg: number;
    salarioEnUMAs: number;
    cuantiaBasica: number;
    cuantiaIncremento: number;
    incrementYears: number;
    totalAnterior: number;
    totalReformado: number;
    metodoUsado: "anterior" | "reformado";
    cuantiaAnual: number;
    cuantiaAnualCon11: number;
    cesantiaFactor: number;
    pensionMensualCesantia: number;
    esposaPC: number;
    hijosPC: number;
    ayudaPC: number;
    topeMensual: number;
    topeCase: "00" | "01" | "02";
    pensionConAsignaciones: number;
    pensionMinima: number;
    usaPensionMinima: boolean;
    isrExencion: number;
    isrBaseGravable: number;
  };
}

function calcPension(input: PensionCalcInput): PensionCalcResult {
  const { salarioPromedio, totalSemanas, edadRetiro, retirementDate, esposa, hijos } = input;

  const emptySteps = {
    salarioPromedio: 0, totalSemanas: 0, edadRetiro: 0, uma: 0, smg: 0,
    salarioEnUMAs: 0, cuantiaBasica: 0, cuantiaIncremento: 0, incrementYears: 0,
    totalAnterior: 0, totalReformado: 0, metodoUsado: "anterior" as const,
    cuantiaAnual: 0, cuantiaAnualCon11: 0, cesantiaFactor: 0, pensionMensualCesantia: 0,
    esposaPC: 0, hijosPC: 0, ayudaPC: 0, topeMensual: 0, topeCase: "00" as const,
    pensionConAsignaciones: 0, pensionMinima: 0, usaPensionMinima: false,
    isrExencion: 0, isrBaseGravable: 0,
  };

  if (totalSemanas < 500 || salarioPromedio <= 0) {
    if (salarioPromedio > 0 && totalSemanas > 0) {
      const year = retirementDate.getUTCFullYear();
      const month = retirementDate.getUTCMonth() + 1;
      const smg = getSMG(year);
      const uma = getUMA(year, month);
      const pensionMinima = smg * 365 / 12 * 1.11;
      const isr = calcISR(pensionMinima, uma);
      return {
        pensionBruta: pensionMinima, isr, pensionNeta: pensionMinima - isr,
        steps: { ...emptySteps, salarioPromedio, totalSemanas, edadRetiro, uma, smg, pensionMinima, usaPensionMinima: true },
      };
    }
    return { pensionBruta: 0, isr: 0, pensionNeta: 0, steps: emptySteps };
  }

  const year = retirementDate.getUTCFullYear();
  const month = retirementDate.getUTCMonth() + 1;
  const uma = getUMA(year, month);
  const smg = getSMG(year);
  const salarioEnUMAs = salarioPromedio / uma;
  const cuantia = lookupCuantia(salarioEnUMAs);
  const incrementYears = calcIncrementYears(totalSemanas);

  const anteriorBasica = salarioPromedio * 365 * 0.35;
  const anteriorInc = incrementYears * salarioPromedio * 0.0125 * 365;
  const totalAnterior = anteriorBasica + anteriorInc;

  const reformadoBasica = salarioPromedio * 365 * cuantia.basica;
  const reformadoInc = incrementYears * salarioPromedio * 365 * cuantia.incremento;
  const totalReformado = reformadoBasica + reformadoInc;

  const metodoUsado = totalAnterior >= totalReformado ? "anterior" as const : "reformado" as const;
  const cuantiaAnual = Math.max(totalAnterior, totalReformado);
  const cuantiaAnualCon11 = cuantiaAnual * 1.11;

  const cesantiaFactor = edadRetiro >= 65 ? 1.0 : (CESANTIA[Math.max(60, Math.floor(edadRetiro))] ?? 0.75);
  const pensionAnualCesantia = cuantiaAnualCon11 * cesantiaFactor;
  const pensionMensualCesantia = pensionAnualCesantia / 12;

  const esposaPC = esposa ? 0.15 : 0;
  const hijosPC = hijos > 0 ? hijos * 0.10 : 0;
  let ayudaPC = 0;
  if (esposaPC === 0 && hijosPC === 0) {
    ayudaPC = 0.15;
  }

  const totalAllowPC = esposaPC + hijosPC + ayudaPC;
  const topeMensual = salarioPromedio * 365 / 12 * 1.11;

  let pensionTotal: number;
  let topeCase: "00" | "01" | "02" = "00";
  const rawTotal = pensionMensualCesantia * (1 + totalAllowPC);

  if (rawTotal <= topeMensual) {
    pensionTotal = rawTotal;
  } else if (pensionMensualCesantia > topeMensual) {
    pensionTotal = pensionMensualCesantia;
    topeCase = "01";
  } else {
    if (totalAllowPC > 0) {
      const factor = ((topeMensual / pensionMensualCesantia) - 1) / totalAllowPC;
      pensionTotal = pensionMensualCesantia * (1 + totalAllowPC * factor);
    } else {
      pensionTotal = pensionMensualCesantia;
    }
    topeCase = "02";
  }

  const pensionMinima = smg * 365 / 12 * 1.11;
  const usaPensionMinima = pensionTotal < pensionMinima;
  const pensionBruta = Math.max(pensionTotal, pensionMinima);
  const isrExencion = 15 * uma * 30.4;
  const isrBaseGravable = Math.max(0, pensionBruta - isrExencion);
  const isr = calcISR(pensionBruta, uma);
  const pensionNeta = pensionBruta - isr;

  return {
    pensionBruta, isr, pensionNeta,
    steps: {
      salarioPromedio, totalSemanas, edadRetiro, uma, smg,
      salarioEnUMAs, cuantiaBasica: cuantia.basica, cuantiaIncremento: cuantia.incremento,
      incrementYears, totalAnterior, totalReformado, metodoUsado,
      cuantiaAnual, cuantiaAnualCon11, cesantiaFactor, pensionMensualCesantia,
      esposaPC, hijosPC, ayudaPC, topeMensual, topeCase,
      pensionConAsignaciones: rawTotal, pensionMinima, usaPensionMinima,
      isrExencion, isrBaseGravable,
    },
  };
}

function recalcPromedio(
  existingPeriods: SalaryPeriodLite[],
  mod40Start: Date,
  mod40End: Date,
  mod40Salary: number,
): number {
  const mod40Days = Math.max(0, daysBetween(mod40Start, mod40End) + 1);
  const mod40Weeks = mod40Days / 7;

  let remainingWeeks = 250;
  let totalResultado = 0;

  const mod40Counted = Math.min(mod40Weeks, remainingWeeks);
  totalResultado += mod40Counted * mod40Salary;
  remainingWeeks -= mod40Counted;

  for (const period of existingPeriods) {
    if (remainingWeeks <= 0) break;
    const weeksCounted = Math.min(period.semanasTotales, remainingWeeks);
    totalResultado += weeksCounted * period.salarioDiario;
    remainingWeeks -= weeksCounted;
  }

  return totalResultado / 250;
}

export interface ScenarioInput {
  salarioPromedio: number;
  salaryPeriods: SalaryPeriodLite[];
  totalSemanas: number;
  semanasReintegradas: number;
  fechaNacimiento: Date;
  ultimaCotizacion: Date;
  mesPensionPronta: Date;
  esposa: boolean;
  hijos: number;
}

export interface ScenarioOutput {
  pensionActual: PensionCalcResult;
  pensionPronta: PensionCalcResult;
  pension6Meses: PensionCalcResult;
  incremento1: number;
  incremento2: number;
  mod40Salary: number;
  mod40WeeksE1: number;
  mod40WeeksE2: number;
  promedioE1: number;
  promedioE2: number;
}

export function calcEscenarios(input: ScenarioInput): ScenarioOutput {
  const {
    salarioPromedio, salaryPeriods, totalSemanas, semanasReintegradas,
    fechaNacimiento, ultimaCotizacion, mesPensionPronta, esposa, hijos,
  } = input;

  const mod40Start = new Date(Date.UTC(
    ultimaCotizacion.getUTCFullYear(),
    ultimaCotizacion.getUTCMonth(),
    ultimaCotizacion.getUTCDate() + 1,
  ));

  const mod40EndE1 = endOfMonth(mesPensionPronta);
  const mesPension6m = new Date(Date.UTC(
    mesPensionPronta.getUTCFullYear(),
    mesPensionPronta.getUTCMonth() + 6,
    1,
  ));
  const mod40EndE2 = endOfMonth(mesPension6m);

  const pensionYear = mesPensionPronta.getUTCFullYear();
  const pensionMonth = mesPensionPronta.getUTCMonth() + 1;
  const uma = getUMA(pensionYear, pensionMonth);
  const mod40Salary = 25 * uma;

  const mod40DaysE1 = daysBetween(mod40Start, mod40EndE1) + 1;
  const mod40WeeksE1 = mod40DaysE1 / 7;
  const mod40DaysE2 = daysBetween(mod40Start, mod40EndE2) + 1;
  const mod40WeeksE2 = mod40DaysE2 / 7;

  const promedioE1 = recalcPromedio(salaryPeriods, mod40Start, mod40EndE1, mod40Salary);
  const promedioE2 = recalcPromedio(salaryPeriods, mod40Start, mod40EndE2, mod40Salary);

  const edadPension = ageAtDate(fechaNacimiento, mesPensionPronta);
  const edadPension6m = ageAtDate(fechaNacimiento, mesPension6m);

  const pensionActual = calcPension({
    salarioPromedio,
    totalSemanas,
    edadRetiro: edadPension,
    retirementDate: ultimaCotizacion,
    esposa,
    hijos,
  });

  const totalSemanasE1 = Math.floor(totalSemanas + semanasReintegradas + mod40WeeksE1);
  const pensionPronta = calcPension({
    salarioPromedio: promedioE1,
    totalSemanas: totalSemanasE1,
    edadRetiro: edadPension,
    retirementDate: mesPensionPronta,
    esposa,
    hijos,
  });

  const totalSemanasE2 = Math.floor(totalSemanas + semanasReintegradas + mod40WeeksE2);
  const pension6Meses = calcPension({
    salarioPromedio: promedioE2,
    totalSemanas: totalSemanasE2,
    edadRetiro: edadPension6m,
    retirementDate: mesPension6m,
    esposa,
    hijos,
  });

  return {
    pensionActual,
    pensionPronta,
    pension6Meses,
    incremento1: pensionPronta.pensionNeta - pensionActual.pensionNeta,
    incremento2: pension6Meses.pensionNeta - pensionActual.pensionNeta,
    mod40Salary,
    mod40WeeksE1,
    mod40WeeksE2,
    promedioE1,
    promedioE2,
  };
}

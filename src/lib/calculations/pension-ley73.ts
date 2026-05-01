import { PensionLey73Estimate } from "./types";

const UMA_DIARIO_2025 = 113.14;
const UMA_MENSUAL = UMA_DIARIO_2025 * 30.4;

interface GrupoSalarial {
  grupo: number;
  limiteInferior: number;
  limiteSuperior: number;
  cuantiaBasica: number;
  incrementoAnual: number;
}

const TABLA_ART_167: GrupoSalarial[] = [
  { grupo: 1, limiteInferior: 0, limiteSuperior: 1.0, cuantiaBasica: 80.0, incrementoAnual: 0.563 },
  { grupo: 2, limiteInferior: 1.01, limiteSuperior: 1.25, cuantiaBasica: 77.11, incrementoAnual: 0.814 },
  { grupo: 3, limiteInferior: 1.26, limiteSuperior: 1.5, cuantiaBasica: 58.18, incrementoAnual: 1.178 },
  { grupo: 4, limiteInferior: 1.51, limiteSuperior: 1.75, cuantiaBasica: 49.23, incrementoAnual: 1.43 },
  { grupo: 5, limiteInferior: 1.76, limiteSuperior: 2.0, cuantiaBasica: 42.67, incrementoAnual: 1.615 },
  { grupo: 6, limiteInferior: 2.01, limiteSuperior: 2.25, cuantiaBasica: 37.65, incrementoAnual: 1.756 },
  { grupo: 7, limiteInferior: 2.26, limiteSuperior: 2.5, cuantiaBasica: 33.68, incrementoAnual: 1.868 },
  { grupo: 8, limiteInferior: 2.51, limiteSuperior: 2.75, cuantiaBasica: 30.48, incrementoAnual: 1.958 },
  { grupo: 9, limiteInferior: 2.76, limiteSuperior: 3.0, cuantiaBasica: 27.83, incrementoAnual: 2.033 },
  { grupo: 10, limiteInferior: 3.01, limiteSuperior: 3.25, cuantiaBasica: 25.6, incrementoAnual: 2.096 },
  { grupo: 11, limiteInferior: 3.26, limiteSuperior: 3.5, cuantiaBasica: 23.7, incrementoAnual: 2.149 },
  { grupo: 12, limiteInferior: 3.51, limiteSuperior: 3.75, cuantiaBasica: 22.07, incrementoAnual: 2.195 },
  { grupo: 13, limiteInferior: 3.76, limiteSuperior: 4.0, cuantiaBasica: 20.65, incrementoAnual: 2.235 },
  { grupo: 14, limiteInferior: 4.01, limiteSuperior: 4.25, cuantiaBasica: 19.39, incrementoAnual: 2.271 },
  { grupo: 15, limiteInferior: 4.26, limiteSuperior: 4.5, cuantiaBasica: 18.29, incrementoAnual: 2.302 },
  { grupo: 16, limiteInferior: 4.51, limiteSuperior: 4.75, cuantiaBasica: 17.3, incrementoAnual: 2.33 },
  { grupo: 17, limiteInferior: 4.76, limiteSuperior: 5.0, cuantiaBasica: 16.41, incrementoAnual: 2.355 },
  { grupo: 18, limiteInferior: 5.01, limiteSuperior: 5.25, cuantiaBasica: 15.61, incrementoAnual: 2.377 },
  { grupo: 19, limiteInferior: 5.26, limiteSuperior: 5.5, cuantiaBasica: 14.88, incrementoAnual: 2.398 },
  { grupo: 20, limiteInferior: 5.51, limiteSuperior: 5.75, cuantiaBasica: 14.22, incrementoAnual: 2.416 },
  { grupo: 21, limiteInferior: 5.76, limiteSuperior: 6.0, cuantiaBasica: 13.62, incrementoAnual: 2.433 },
  { grupo: 22, limiteInferior: 6.01, limiteSuperior: Infinity, cuantiaBasica: 13.0, incrementoAnual: 2.45 },
];

const FACTORES_EDAD: { edad: number; factor: number }[] = [
  { edad: 60, factor: 0.75 },
  { edad: 61, factor: 0.8 },
  { edad: 62, factor: 0.85 },
  { edad: 63, factor: 0.9 },
  { edad: 64, factor: 0.95 },
  { edad: 65, factor: 1.0 },
];

function findGrupoSalarial(vecesUMA: number): GrupoSalarial {
  for (const g of TABLA_ART_167) {
    if (vecesUMA <= g.limiteSuperior) return g;
  }
  return TABLA_ART_167[TABLA_ART_167.length - 1];
}

export function calculatePensionLey73(
  promedioDiario: number,
  semanasReconocidas: number
): PensionLey73Estimate {
  const sbcPromedioMensual = promedioDiario * 30.4;
  const vecesUMA = promedioDiario / UMA_DIARIO_2025;
  const grupo = findGrupoSalarial(vecesUMA);

  const semanasMinimas = 500;
  const anosExcedentes = Math.max(0, Math.floor((semanasReconocidas - semanasMinimas) / 52));
  const porcentajeTotal = Math.min(
    100,
    grupo.cuantiaBasica + grupo.incrementoAnual * anosExcedentes
  );

  const pensionBase = sbcPromedioMensual * (porcentajeTotal / 100);

  const estimaciones = FACTORES_EDAD.map(({ edad, factor }) => ({
    edad,
    factorEdad: factor,
    pensionMensual: Math.max(pensionBase * factor, UMA_MENSUAL),
  }));

  return {
    sbcPromedioDiario: promedioDiario,
    sbcPromedioMensual,
    semanasReconocidas,
    grupoSalarial: grupo.grupo,
    cuantiaBasicaPct: grupo.cuantiaBasica,
    incrementoAnualPct: grupo.incrementoAnual,
    anosExcedentes,
    porcentajeTotal,
    estimaciones,
    pensionMinima: UMA_MENSUAL,
  };
}

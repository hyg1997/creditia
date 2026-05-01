import { ParsedDocument, CalculationResult } from "./types";
import { detectRegimen } from "./regime";
import { calculateSalaryAverage } from "./salary-average";
import { calculateAfore } from "./afore-balance";
import { calculatePensionLey73 } from "./pension-ley73";

export function calculateAll(document: ParsedDocument): CalculationResult {
  const regimen = detectRegimen(
    document.records,
    document.movements,
    document.salaryPeriods
  );
  const salaryAverage = calculateSalaryAverage(document.salaryPeriods);
  const afore = calculateAfore(document.salaryPeriods);
  const advertencias = buildAdvertencias(document, regimen);

  const result: CalculationResult = {
    regimen,
    header: document.header,
    records: document.records,
    salaryAverage,
    afore,
    advertencias,
  };

  if (regimen === "ley73") {
    const semanas =
      document.header.totalSemanasCotizadas ||
      document.header.semanasReconocidas;
    result.pensionLey73 = calculatePensionLey73(
      salaryAverage.promedio,
      semanas
    );
  }

  return result;
}

function buildAdvertencias(doc: ParsedDocument, regimen: string): string[] {
  const warnings: string[] = [];

  const hasLongSingleSalaryPeriod = doc.salaryPeriods.some((sp) => {
    const years =
      (sp.fechaFin.getTime() - sp.fechaInicio.getTime()) /
      (365.25 * 24 * 60 * 60 * 1000);
    return years > 5;
  });

  if (hasLongSingleSalaryPeriod) {
    warnings.push(
      "Uno o mas periodos usan un solo salario por mas de 5 anos. " +
        "Se aplico ajuste por inflacion (INPC) para estimar salarios anteriores, " +
        "pero el calculo sigue siendo aproximado. Consulta tu estado de cuenta AFORE " +
        "para el saldo real."
    );
  }

  if (doc.movements.length === 0 && doc.records.length > 0) {
    warnings.push(
      "No se encontraron movimientos detallados. Se uso el SBC final de cada " +
        "registro patronal ajustado por inflacion (INPC) para estimar salarios anteriores."
    );
  }

  if (regimen === "ley73") {
    warnings.push(
      "Regimen Ley 73: La pension mensual la paga el IMSS como beneficio definido. " +
        "El saldo AFORE (SAR 92) se entrega como pago unico. " +
        "Vivienda la administra INFONAVIT (puede ser $0 si usaste credito). " +
        "Los recursos RCV pueden complementar la pension o devolverse."
    );
  }

  return warnings;
}

export type { CalculationResult, ParsedDocument } from "./types";

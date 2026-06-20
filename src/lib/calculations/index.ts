import { ParsedDocument, CalculationResult } from "./types";
import { detectRegimen } from "./regime";
import { calculateSalaryAverage } from "./salary-average";
import { calculateAfore } from "./afore-balance";
import { calculateRetirosDesempleo } from "./retiros-desempleo";

export function calculateAll(document: ParsedDocument): CalculationResult {
  const regimen = detectRegimen(
    document.records,
    document.movements,
    document.salaryPeriods
  );
  const salaryAverage = calculateSalaryAverage(document.salaryPeriods);
  const afore = calculateAfore(
    document.salaryPeriods,
    document.header.semanasDescontadas,
    document.header.semanasReconocidas,
  );
  const retirosDesempleo = calculateRetirosDesempleo(document.records);

  return {
    regimen,
    header: document.header,
    records: document.records,
    salaryAverage,
    afore,
    retirosDesempleo,
  };
}

export type { CalculationResult, ParsedDocument } from "./types";

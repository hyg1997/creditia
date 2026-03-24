import { ParsedDocument, CalculationResult } from "./types";
import { calculateSalaryAverage } from "./salary-average";
import { calculateAfore } from "./afore-balance";

export function calculateAll(document: ParsedDocument): CalculationResult {
  const salaryAverage = calculateSalaryAverage(document.salaryPeriods);
  const afore = calculateAfore(document.salaryPeriods);

  return {
    header: document.header,
    records: document.records,
    salaryAverage,
    afore,
  };
}

export type { CalculationResult, ParsedDocument } from "./types";

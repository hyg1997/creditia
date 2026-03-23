import { ParsedDocument, CalculationResult } from "./types";
import { calculateSalaryAverage } from "./salary-average";
import { calculateAfore } from "./afore-balance";

export function calculateAll(document: ParsedDocument): CalculationResult {
  const salaryAverage = calculateSalaryAverage(document.records);
  const afore = calculateAfore(document.records);

  return {
    header: document.header,
    records: document.records,
    salaryAverage,
    afore,
  };
}

export type { CalculationResult, ParsedDocument } from "./types";

import { EmploymentRecord, Movement, SalaryPeriod, Regimen } from "./types";

const LEY97_CUTOFF = Date.UTC(1997, 6, 1); // July 1, 1997

export function detectRegimen(
  records: EmploymentRecord[],
  movements: Movement[],
  salaryPeriods: SalaryPeriod[]
): Regimen {
  for (const r of records) {
    if (r.fechaAlta.getTime() < LEY97_CUTOFF) return "ley73";
  }
  for (const m of movements) {
    if (
      (m.type === "ALTA" || m.type === "REINGRESO") &&
      m.fecha.getTime() < LEY97_CUTOFF
    )
      return "ley73";
  }
  for (const sp of salaryPeriods) {
    if (sp.fechaInicio.getTime() < LEY97_CUTOFF) return "ley73";
  }
  return "ley97";
}

export type Regimen = "ley73" | "ley97";

export interface EmploymentRecord {
  patron: string;
  registroPatronal: string;
  entidadFederativa: string;
  fechaAlta: Date;
  fechaBaja: Date;
  salarioBaseCotizacion: number;
}

export interface Movement {
  type: "BAJA" | "REINGRESO" | "MODIFICACION DE SALARIO" | "ALTA";
  fecha: Date;
  salario: number;
}

export interface SalaryPeriod {
  fechaInicio: Date;
  fechaFin: Date;
  salarioDiario: number;
}

export interface DocumentHeader {
  nombre: string;
  nss: string;
  curp: string;
  totalSemanasCotizadas: number;
  semanasReconocidas: number;
  semanasDescontadas: number;
  semanasReintegradas: number;
}

export interface ParsedDocument {
  header: DocumentHeader;
  records: EmploymentRecord[];
  movements: Movement[];
  salaryPeriods: SalaryPeriod[];
}

export interface SubcuentaTotal {
  aportaciones: number;
  rendimientos: number;
  total: number;
}

export interface PeriodAfore {
  year: number;
  salarioDiario: number;
  dias: number;
  totalSalario: number;
  sar92: number;
  vivienda92: number;
  retiro: number;
  ceavTrabajador: number;
  ceavPatron: number;
  cuotaSocial: number;
  vivienda97: number;
}

export interface AforeResult {
  sar92: SubcuentaTotal;
  vivienda92: SubcuentaTotal;
  retiro: SubcuentaTotal;
  ceavTrabajador: SubcuentaTotal;
  ceavPatron: SubcuentaTotal;
  cuotaSocial: SubcuentaTotal;
  vivienda97: SubcuentaTotal;

  totalRCV: number;
  totalSAR92: number;
  totalVivienda: number;
  saldoTotal: number;

  periods: PeriodAfore[];
}

export interface SalaryAverageResult {
  promedio: number;
  periods: {
    fechaAlta: Date;
    fechaBaja: Date;
    salarioDiario: number;
    dias: number;
    semanasTotales: number;
    semanasContadas: number;
    resultado: number;
  }[];
}

export interface PensionLey73Estimate {
  sbcPromedioDiario: number;
  sbcPromedioMensual: number;
  semanasReconocidas: number;
  grupoSalarial: number;
  cuantiaBasicaPct: number;
  incrementoAnualPct: number;
  anosExcedentes: number;
  porcentajeTotal: number;
  estimaciones: {
    edad: number;
    factorEdad: number;
    pensionMensual: number;
  }[];
  pensionMinima: number;
}

export interface CalculationResult {
  regimen: Regimen;
  header: DocumentHeader;
  records: EmploymentRecord[];
  salaryAverage: SalaryAverageResult;
  afore: AforeResult;
  pensionLey73?: PensionLey73Estimate;
  advertencias: string[];
}

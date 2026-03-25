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

export interface PeriodAfore {
  year: number;
  salarioDiario: number;
  dias: number;
  totalSalario: number;
  sar92: number;
  sar92Rendimientos: number;
  sar97: number;
  sar97Rendimientos: number;
  rcvTrabajador: number;
  rcvTrabajadorRendimientos: number;
  rcvPatron: number;
  rcvPatronRendimientos: number;
  vivienda92: number;
  vivienda92Rendimientos: number;
  vivienda97: number;
  vivienda97Rendimientos: number;
}

export interface AforeResult {
  periods: PeriodAfore[];
  totals: {
    sar92: number;
    sar92Rendimientos: number;
    sar97: number;
    sar97Rendimientos: number;
    rcvTrabajador: number;
    rcvTrabajadorRendimientos: number;
    rcvPatron: number;
    rcvPatronRendimientos: number;
    vivienda92: number;
    vivienda92Rendimientos: number;
    vivienda97: number;
    vivienda97Rendimientos: number;
  };
  saldoAfore: number; // (SAR92+rend) + (SAR97+rend) + (Viv92+rend) + (Viv97+rend)
  saldoRCV: number; // (RCV trab+rend) + (RCV patron+rend) - separate
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

export interface CalculationResult {
  header: DocumentHeader;
  records: EmploymentRecord[];
  salaryAverage: SalaryAverageResult;
  afore: AforeResult;
}

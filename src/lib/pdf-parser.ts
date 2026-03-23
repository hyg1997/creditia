import { DocumentHeader, EmploymentRecord, ParsedDocument } from "./calculations/types";

/**
 * Parsea el texto OCR extraído de una Constancia de Semanas Cotizadas del IMSS.
 *
 * El texto proviene de tesseract.js corriendo en el cliente. El formato es:
 *
 * Header:
 *   Nombre, NSS, CURP, Total de semanas cotizadas
 *   Semanas cotizadas IMSS, Descontadas, Reintegradas
 *
 * Cada registro laboral:
 *   Nombre del patrón [NOMBRE]
 *   Registro Patronal [NUMERO]
 *   Entidad federativa [ESTADO]
 *   Fecha de alta DD/MM/YYYY Fecha de baja DD/MM/YYYY Salario Base de Cotización * $ [MONTO]
 */
export function parseOCRText(text: string): ParsedDocument {
  const header = parseHeader(text);
  const records = parseRecords(text);
  return { header, records };
}

function parseHeader(text: string): DocumentHeader {
  // Extract name - appears after "Estimado(a)," on the next non-empty line
  let nombre = "";
  const nameMatch = text.match(/Estimado\(a\)[,.]?\s*\n+\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+)/);
  if (nameMatch) {
    nombre = nameMatch[1].trim();
  }

  // Extract NSS
  const nssMatch = text.match(/NSS[:\s]+(\d[\d\s]+\d)/);
  const nss = nssMatch ? nssMatch[1].replace(/\s/g, "") : "";

  // Extract CURP
  const curpMatch = text.match(/CURP[:\s]+([A-Z0-9]{18})/i);
  const curp = curpMatch ? curpMatch[1] : "";

  // Extract total weeks - appears after "Total de semanas cotizadas" or near CURP
  // OCR often puts "CURP: XXXXX 620" where 620 is the total
  let totalSemanasCotizadas = 0;
  const curpWeeksMatch = text.match(/CURP[:\s]+[A-Z0-9]{18}\s+(\d{2,4})/i);
  if (curpWeeksMatch) {
    totalSemanasCotizadas = parseInt(curpWeeksMatch[1], 10);
  }
  if (!totalSemanasCotizadas) {
    const totalWeeksMatch = text.match(
      /Total de semanas cotizadas[\s\S]{0,100}?(\d{2,4})/i
    );
    if (totalWeeksMatch) {
      totalSemanasCotizadas = parseInt(totalWeeksMatch[1], 10);
    }
  }

  // Extract IMSS weeks - appears after "Semanas cotizadas IMSS"
  const imssWeeksMatch = text.match(
    /Semanas cotizadas IMSS[\s\S]{0,50}?(\d{2,4})/i
  );
  let semanasReconocidas = 0;
  if (imssWeeksMatch) {
    semanasReconocidas = parseInt(imssWeeksMatch[1], 10);
  }

  // Extract semanas descontadas
  const descMatch = text.match(
    /Semanas Descontadas[\s\S]{0,100}?(\d{1,4})/i
  );
  let semanasDescontadas = 0;
  if (descMatch) {
    semanasDescontadas = parseInt(descMatch[1], 10);
  }

  // Extract semanas reintegradas - the number right after the label
  const reintMatch = text.match(
    /Semanas Reintegradas\s*\(\+\)\s*\n?\s*(\d{1,4})/i
  );
  let semanasReintegradas = 0;
  if (reintMatch) {
    semanasReintegradas = parseInt(reintMatch[1], 10);
  }

  return {
    nombre,
    nss,
    curp,
    totalSemanasCotizadas,
    semanasReconocidas,
    semanasDescontadas,
    semanasReintegradas,
  };
}

function parseDate(dateStr: string): Date {
  // DD/MM/YYYY format
  const parts = dateStr.split("/").map((s) => s.trim());
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date(dateStr);
}

function parseSalary(salaryStr: string): number {
  // Remove $, commas, spaces; handle OCR variations
  const cleaned = salaryStr
    .replace(/[$,\s]/g, "")
    .replace(/[oO]/g, "0") // OCR sometimes reads 0 as o/O
    .trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parseRecords(text: string): EmploymentRecord[] {
  const records: EmploymentRecord[] = [];

  // Split by "Nombre del patr" to get each record section
  // Handle OCR variations: patron, patrón, patrén, etc.
  const sections = text.split(/Nombre del patr[oóéeë]n/i);

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];

    // Extract patron name - text between "Nombre del patron" and "Registro Patronal"
    // Handle cases where name is on same line or next line(s)
    let patron = "";
    const patronMatch = section.match(new RegExp("^\\s*\\n?\\s*(.+?)(?=\\s*\\n\\s*Registro|\\s+Registro)", "s"));
    if (patronMatch) {
      patron = patronMatch[1].replace(/\n/g, " ").trim();
    }

    // If patron name is "Registro Patronal" or similar garbage, try extracting differently
    // Some OCR outputs put the name on a separate line
    if (!patron || /^Registro/i.test(patron) || /^Tu\s/i.test(patron)) {
      // Try: name might be right after the split on first non-empty line
      const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
      // First non-empty line that isn't "Registro" or page header
      const nameLine = lines.find(
        (l) =>
          l.length > 2 &&
          !/^Registro/i.test(l) &&
          !/^Entidad/i.test(l) &&
          !/^Fecha/i.test(l) &&
          !/^Tu\s/i.test(l) &&
          !/^Semanas/i.test(l) &&
          !/^\*/i.test(l) &&
          !/^Instituto/i.test(l) &&
          !/^Valor/i.test(l)
      );
      patron = nameLine || "";
    }

    // Skip if still no valid patron name
    if (!patron) continue;

    // Extract Registro Patronal
    const regMatch = section.match(
      /Registro Patronal\s+([A-Z0-9]+)/i
    );
    const registroPatronal = regMatch ? regMatch[1].trim() : "";

    // Extract Entidad Federativa
    const entMatch = section.match(
      /Entidad federativa\s+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|Fecha)/i
    );
    const entidadFederativa = entMatch ? entMatch[1].trim() : "";

    // Extract dates and salary
    // Pattern: Fecha de alta DD/MM/YYYY Fecha de baja DD/MM/YYYY Salario...$ AMOUNT
    const datesSalaryMatch = section.match(
      /Fecha de alta\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+Fecha de baja\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+Salario[^$]*\$\s*([\d.,]+)/i
    );

    if (!datesSalaryMatch) continue;

    const fechaAlta = parseDate(datesSalaryMatch[1]);
    const fechaBaja = parseDate(datesSalaryMatch[2]);
    const salarioBaseCotizacion = parseSalary(datesSalaryMatch[3]);

    // Validate dates
    if (isNaN(fechaAlta.getTime()) || isNaN(fechaBaja.getTime())) continue;
    if (salarioBaseCotizacion <= 0) continue;

    records.push({
      patron,
      registroPatronal,
      entidadFederativa,
      fechaAlta,
      fechaBaja,
      salarioBaseCotizacion,
    });
  }

  return records;
}

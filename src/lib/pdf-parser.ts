import {
  DocumentHeader,
  EmploymentRecord,
  Movement,
  SalaryPeriod,
  ParsedDocument,
} from "./calculations/types";

/**
 * Parsea el texto OCR extraído de una Constancia de Semanas Cotizadas del IMSS.
 *
 * Maneja múltiples variantes de OCR:
 * - PDFs escaneados con CamScanner (layout de una sola columna)
 * - PDFs digitales del portal IMSS (layout multi-columna que OCR puede descomponer)
 * - Registros donde fechas/salarios aparecen en la tabla de movimientos en vez de inline
 */
export function parseOCRText(text: string): ParsedDocument {
  const header = parseHeader(text);
  const records = parseRecords(text);
  const movements = parseMovements(text);

  // Extract report emission date for "Vigente" (active employment) calculations
  const reportDate = extractReportDate(text);
  let salaryPeriods = deriveSalaryPeriods(movements, reportDate);

  // Fallback: if movement extraction yields no salary periods,
  // derive simple periods from employment records (one period per record)
  if (salaryPeriods.length === 0 && records.length > 0) {
    salaryPeriods = records.map((r) => ({
      fechaInicio: r.fechaAlta,
      fechaFin: r.fechaBaja,
      salarioDiario: r.salarioBaseCotizacion,
    }));
  }

  return { header, records, movements, salaryPeriods };
}

function extractReportDate(text: string): Date | undefined {
  // Native: "Fecha de emisión del reporte 13   /   01   /   2026"
  const native = text.match(/Fecha de emisi[oó]n del reporte\s+(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/i);
  if (native) {
    return new Date(parseInt(native[3]), parseInt(native[2]) - 1, parseInt(native[1]));
  }
  // OCR: "Fecha de emisi6n del reporte\n\n27 / 01 / 2026"
  const ocr = text.match(/Fecha de emisi[oó6]n del reporte\s+(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/i);
  if (ocr) {
    return new Date(parseInt(ocr[3]), parseInt(ocr[2]) - 1, parseInt(ocr[1]));
  }
  return undefined;
}

function parseHeader(text: string): DocumentHeader {
  // Extract name - try multiple patterns
  let nombre = "";

  // Pattern 1: Name after "Estimado(a)," (OCR multi-line PDFs)
  const nameMatch1 = text.match(
    /Estimado\(a\)[,.]?\s*\n+\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+)/
  );
  if (nameMatch1) {
    nombre = nameMatch1[1].trim();
  }

  // Pattern 2: Name on its own line after header (OCR)
  if (!nombre) {
    const nameMatch2 = text.match(
      /(?:persona asegurada|historial de registros)\s*\n+\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]{5,})/i
    );
    if (nameMatch2) {
      nombre = nameMatch2[1].trim();
    }
  }

  // Pattern 3: Native PDF — "NSS: NAME NSSDIGITS"
  if (!nombre) {
    const nativeBlock = text.match(
      /NSS:\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+)\s+\d{10,11}/
    );
    if (nativeBlock) {
      nombre = nativeBlock[1].trim();
    }
  }

  // Pattern 4: From the cadena original (fallback for both native and OCR)
  if (!nombre) {
    const nameMatch3 = text.match(
      /Apellido Paterno[:\s]*([A-ZÁÉÍÓÚÑ]+)\|?.*?Apellido Materno[:\s]*([A-ZÁÉÍÓÚÑ]+)\|?.*?Nombre[^|]*[:\s]*([A-ZÁÉÍÓÚÑ ]+?)[\|]/i
    );
    if (nameMatch3) {
      nombre =
        `${nameMatch3[1]} ${nameMatch3[2]} ${nameMatch3[3]}`.trim();
    }
  }

  // Extract NSS
  const nssMatch = text.match(/NSS[:\s]+(\d[\d\s]+\d)/);
  let nss = nssMatch ? nssMatch[1].replace(/\s/g, "") : "";

  // Native PDF: "NSS: NAME 17856416379" — NSS is 11 digits after the name
  if (!nss) {
    const nssNative = text.match(/NSS:\s*[A-ZÁÉÍÓÚÑ ]+?\s+(\d{10,11})/);
    if (nssNative) nss = nssNative[1];
  }

  // Extract CURP — try after "CURP:" label first, then before it (native PDF)
  const curpMatch = text.match(/CURP[:\s]+([A-Z0-9]{18})/i);
  let curp = curpMatch ? curpMatch[1] : "";
  if (!curp) {
    const curpNative = text.match(/(\w{4}\d{6}\w{8})\s+CURP/);
    if (curpNative) curp = curpNative[1];
  }

  // Extract total weeks
  let totalSemanasCotizadas = 0;

  // Try: "CURP: XXXXX 620" (OCR puts total weeks adjacent to CURP)
  const curpWeeksMatch = text.match(
    /CURP[:\s]+[A-Z0-9]{18}\s+(\d{2,4})/i
  );
  if (curpWeeksMatch) {
    totalSemanasCotizadas = parseInt(curpWeeksMatch[1], 10);
  }

  // Try: explicit "Total de semanas cotizadas" followed by a number (OCR or native inline)
  if (!totalSemanasCotizadas) {
    const totalWeeksMatch = text.match(
      /Total de semanas cotizadas\s+(\d{2,4})/i
    );
    if (totalWeeksMatch) {
      totalSemanasCotizadas = parseInt(totalWeeksMatch[1], 10);
    }
  }

  // Try: from cadena original
  if (!totalSemanasCotizadas) {
    const cadenaMatch = text.match(
      /total de semanas cotizadas[:\s]*(\d{2,4})/i
    );
    if (cadenaMatch) {
      totalSemanasCotizadas = parseInt(cadenaMatch[1], 10);
    }
  }

  // Extract IMSS weeks
  const imssWeeksMatch = text.match(
    /Semanas cotizadas IMSS\s*\n+\s*(\d{2,4})/i
  );
  let semanasReconocidas = 0;
  if (imssWeeksMatch) {
    semanasReconocidas = parseInt(imssWeeksMatch[1], 10);
  }

  // Extract semanas descontadas and reintegradas
  // These often appear as "149 0" on the same line after their labels
  let semanasDescontadas = 0;
  let semanasReintegradas = 0;

  // Try pattern: both numbers on one line after the labels section (OCR)
  const bothMatch = text.match(
    /Semanas Reintegradas\s*\(\+\)\s*\n+\s*(\d{1,4})\s+(\d{1,4})/i
  );
  if (bothMatch) {
    semanasDescontadas = parseInt(bothMatch[1], 10);
    semanasReintegradas = parseInt(bothMatch[2], 10);
  }

  // Native inline: "1112   149   0 Semanas cotizadas IMSS"
  // where 1112=IMSS weeks, 149=descontadas, 0=reintegradas
  if (!semanasDescontadas) {
    const nativeWeeks = text.match(
      /(\d{2,4})\s+(\d{1,4})\s+(\d{1,4})\s+Semanas cotizadas IMSS/i
    );
    if (nativeWeeks) {
      semanasReconocidas = parseInt(nativeWeeks[1], 10);
      semanasDescontadas = parseInt(nativeWeeks[2], 10);
      semanasReintegradas = parseInt(nativeWeeks[3], 10);
    }
  }

  if (!semanasDescontadas) {
    // Try separate extraction
    const descMatch = text.match(
      /Semanas Descontadas[\s\S]{0,80}?(?:recursos\)\s*\(-\))\s*\n?\s*(\d{1,4})/i
    );
    if (descMatch) {
      semanasDescontadas = parseInt(descMatch[1], 10);
    }

    const reintMatch = text.match(
      /Semanas Reintegradas\s*\(\+\)\s*\n?\s*(\d{1,4})/i
    );
    if (reintMatch) {
      semanasReintegradas = parseInt(reintMatch[1], 10);
    }
  }

  // Validate: if descontadas seems too large for a reintegradas value, swap check
  // Total = IMSS - descontadas + reintegradas
  // Sanity check: if computed total doesn't match, try to fix
  if (
    totalSemanasCotizadas > 0 &&
    semanasReconocidas > 0 &&
    semanasReconocidas - semanasDescontadas + semanasReintegradas !==
      totalSemanasCotizadas
  ) {
    // Maybe the two numbers are swapped or only descontadas was captured
    // Try: total = imss - desc + reint
    if (
      semanasReconocidas - semanasDescontadas === totalSemanasCotizadas
    ) {
      semanasReintegradas = 0;
    }
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

function parseDate(dateStr: string): Date | null {
  const parts = dateStr.split("/").map((s) => s.trim());
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (year > 1900 && year < 2100 && month >= 0 && month < 12 && day > 0 && day <= 31) {
      return new Date(year, month, day);
    }
  }
  return null;
}

function parseSalary(salaryStr: string): number {
  const cleaned = salaryStr
    .replace(/[$,\s]/g, "")
    .trim();
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Checks if a string looks like a valid patron name (not OCR garbage).
 */
function isValidPatronName(name: string): boolean {
  if (name.length < 2) return false;
  // Reject common OCR garbage and page elements
  if (/^[@()\d]/.test(name)) return false;
  if (/^(Registro|Entidad|Fecha|Tu\s|Semanas|Instituto|Valor|Tipo|Contacto|gob\.mx|\(por|BAJA\s|REINGRESO|MODIFI|ALTA\s|Pagina|Paseo|Col\.|C\.P\.|Tel\.|http|DD\s|Importante)/i.test(name)) return false;
  // Reject exact movement type keywords
  if (/^(BAJA|ALTA|REINGRESO)$/i.test(name)) return false;
  // Reject common entidad names that might be confused with patron names
  if (/^CIUDAD DE MEXICO$/i.test(name)) return false;
  if (/mexico\s*(Geovner|Gooner)/i.test(name)) return false;
  if (/GOBIERNO|CONAMER|IMSS\s*$/i.test(name)) return false;
  if (/^(Cs|GG,|Se\?)\s/i.test(name)) return false;
  // Must have at least some letter characters
  const letters = name.replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ]/g, "");
  return letters.length >= 2;
}

/**
 * Extracts patron name from a section, handling multiple OCR layouts.
 */
function extractPatron(section: string): string {
  // Strategy 1: Text between split point and "Registro Patronal"
  const s = new RegExp(
    "^\\s*\\n?\\s*(.+?)(?=\\s*\\n\\s*Registro|\\s+Registro)",
    "s"
  );
  const match1 = section.match(s);
  if (match1) {
    const name = match1[1].replace(/\n/g, " ").trim();
    if (isValidPatronName(name)) {
      return name;
    }
  }

  // Strategy 2: First meaningful line in the section
  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const l of lines) {
    if (isValidPatronName(l) && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(l)) {
      return l;
    }
  }
  return "";
}

/**
 * Two-pass record parser that handles multi-column OCR layouts.
 *
 * Pass 1: Parse sections for inline data (some records will be incomplete).
 * Pass 2: Search the full text globally to fill in missing baja dates and salaries.
 *
 * Multi-column OCR renders left column (record headers) first, then right column
 * (movement dates, salaries). This means a record's baja date and salary may appear
 * in a completely different section of the OCR text.
 */
function parseRecords(text: string): EmploymentRecord[] {
  // ══════════════════════════════════════════════════════════════════
  // Phase 1: Pre-extract global evidence from the full OCR text
  // ══════════════════════════════════════════════════════════════════

  // Type A: "DD/MM/YYYY Salario Base de Cotizacion * $ NNN"
  // These are baja dates + salary from split-column rendering
  interface Evidence {
    date: Date;
    salary: number;
    pos: number;
    claimed: boolean;
  }

  const bajaSalaryCombos: Evidence[] = [];
  // IMPORTANT: Use [ \t]+ (not \s+) to avoid matching across line breaks,
  // which creates false combos from adjacent but unrelated data
  const bscRe =
    /(\d{1,2}\/\d{1,2}\/\d{4})[ \t]+Salario Base de Cotizaci[oóéeëi]\w*\s*\*?\s*\$\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = bscRe.exec(text)) !== null) {
    const d = parseDate(m[1]);
    const s = parseSalary(m[2]);
    if (d && s > 0)
      bajaSalaryCombos.push({ date: d, salary: s, pos: m.index, claimed: false });
  }

  // Type B: "BAJA DD/MM/YYYY $ NNN" (inline movement table rows)
  const bajaMovRows: Evidence[] = [];
  const bmRe = /\bBAJA\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+\$\s*([\d.,]+)/gi;
  while ((m = bmRe.exec(text)) !== null) {
    const d = parseDate(m[1]);
    const s = parseSalary(m[2]);
    if (d && s > 0)
      bajaMovRows.push({ date: d, salary: s, pos: m.index, claimed: false });
  }

  // Type C: All standalone "Salario Base de Cotizacion * $ NNN" entries
  interface SalaryEvidence {
    salary: number;
    pos: number;
    claimed: boolean;
  }
  const salaryEntries: SalaryEvidence[] = [];
  const slRe =
    /Salario Base de Cotizaci[oóéeëi]\w*\s*\*?\s*\$\s*([\d.,]+)/gi;
  while ((m = slRe.exec(text)) !== null) {
    const s = parseSalary(m[1]);
    if (s > 0) salaryEntries.push({ salary: s, pos: m.index, claimed: false });
  }

  // ══════════════════════════════════════════════════════════════════
  // Phase 2: Parse each section for inline data
  // ══════════════════════════════════════════════════════════════════

  interface PartialRecord {
    patron: string;
    registroPatronal: string;
    entidadFederativa: string;
    fechaAlta: Date;
    fechaAltaStr: string;
    fechaBaja: Date | null;
    salarioBaseCotizacion: number;
    sectionPos: number; // char position of section start in full text
  }

  const partials: PartialRecord[] = [];

  // Find exact positions of each "Nombre del patron" marker in the text
  const markerPositions: number[] = [];
  const markerRe = /Nombre del patr[oóéeëa]n/gi;
  while ((m = markerRe.exec(text)) !== null) {
    markerPositions.push(m.index);
  }

  for (let i = 0; i < markerPositions.length; i++) {
    const sectionStart = markerPositions[i];
    const sectionEnd =
      i + 1 < markerPositions.length ? markerPositions[i + 1] : text.length;
    // Skip the "Nombre del patron" marker itself (~18 chars)
    let section = text.substring(sectionStart + 18, sectionEnd);

    // Handle the first section which is a table header containing the first record
    // after "Tu historia laboral". Trim to just the record data.
    if (section.match(/Tu historia laboral/i)) {
      const histIdx = section.search(/Tu historia laboral/i);
      section = section.substring(histIdx + 20);
    }

    // Skip sections with no "Fecha de alta" at all
    if (!section.match(/Fecha de alta/i)) continue;

    // Extract patron name
    let patron = extractPatron(section);

    // For garbled sections where patron name appears AFTER other fields
    // (e.g., DESARROLLO Y VINCULACION where name is between garbage lines)
    if (!patron || !isValidPatronName(patron)) {
      // Try finding a name-like line anywhere in the section
      const allLines = section.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of allLines) {
        if (
          isValidPatronName(line) &&
          !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(line) &&
          !/Salario/i.test(line) &&
          !/Fecha de/i.test(line) &&
          !/Semanas/i.test(line) &&
          !/Cotizaci/i.test(line) &&
          line.length > 3 &&
          line.length < 80
        ) {
          patron = line;
          break;
        }
      }
    }

    // Extract Registro Patronal (may be on same line or next line after garbled OCR)
    let registroPatronal = "";
    const regMatch = section.match(/Registro Patronal\s+([A-Z]\d{8,10}\d)/i);
    if (regMatch) {
      registroPatronal = regMatch[1].trim();
    } else {
      // Look for patronal-format ID on its own line (e.g., "A084290910")
      const regLine = section.match(/\n\s*([A-Z]\d{8,10}\d)\s*\n/);
      if (regLine) registroPatronal = regLine[1].trim();
      // Also handle purely numeric (e.g., "0101115710")
      if (!registroPatronal) {
        const numReg = section.match(/Registro Patronal\s+(\d{10,11})/i);
        if (numReg) registroPatronal = numReg[1].trim();
      }
    }

    // Extract Entidad Federativa
    const entMatch = section.match(
      /Entidad federativa\s+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|Fecha)/i
    );
    const entidadFederativa = entMatch ? entMatch[1].trim() : "";

    // === Extract dates (inline only — conservative to avoid wrong matches) ===
    let fechaAlta: Date | null = null;
    let fechaAltaStr = "";
    let fechaBaja: Date | null = null;
    let salarioBaseCotizacion = 0;

    // Strategy A: Full inline match
    const fullMatch = section.match(
      /Fecha de alta\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+Fecha de baja\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+Salario[^$]*\$\s*([\d.,]+)/i
    );
    if (fullMatch) {
      fechaAlta = parseDate(fullMatch[1]);
      fechaAltaStr = fullMatch[1];
      fechaBaja = parseDate(fullMatch[2]);
      salarioBaseCotizacion = parseSalary(fullMatch[3]);
    }

    // Strategy B: Dates inline, no salary on same line
    if (!fechaAlta || !fechaBaja) {
      const datesOnlyMatch = section.match(
        /Fecha de alta\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+Fecha de baja\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
      );
      if (datesOnlyMatch) {
        fechaAlta = parseDate(datesOnlyMatch[1]);
        fechaAltaStr = datesOnlyMatch[1];
        fechaBaja = parseDate(datesOnlyMatch[2]);
      }
    }

    // Strategy C: Alta inline, baja empty
    if (!fechaAlta) {
      const altaOnlyMatch = section.match(
        /Fecha de alta\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
      );
      if (altaOnlyMatch) {
        fechaAlta = parseDate(altaOnlyMatch[1]);
        fechaAltaStr = altaOnlyMatch[1];
      }
    }

    // Strategy D: Alta date far from "Fecha de alta" (garbled OCR like DESARROLLO Y VINCULACION)
    if (!fechaAlta) {
      const altaFar = new RegExp(
        "Fecha de alta[\\s\\S]{0,300}?(\\d{1,2}\\/\\d{1,2}\\/\\d{4})",
        "i"
      );
      const altaFarMatch = section.match(altaFar);
      if (altaFarMatch) {
        fechaAlta = parseDate(altaFarMatch[1]);
        fechaAltaStr = altaFarMatch[1];
      }
    }

    if (!fechaAlta) continue;

    // For salary when dates are inline but salary was split to right column
    if (salarioBaseCotizacion <= 0 && fechaBaja) {
      // Only look for salary on the same "Fecha de alta/baja" line or just after
      const salMatch = section.match(
        /Fecha de (?:alta|baja)\s+\d{1,2}\/\d{1,2}\/\d{4}[\s\S]{0,100}?Salario[^$]*\$\s*([\d.,]+)/i
      );
      if (salMatch) {
        salarioBaseCotizacion = parseSalary(salMatch[1]);
      }
    }

    partials.push({
      patron: patron || `Registro ${registroPatronal}`,
      registroPatronal,
      entidadFederativa,
      fechaAlta,
      fechaAltaStr,
      fechaBaja,
      salarioBaseCotizacion,
      sectionPos: sectionStart,
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // Phase 3: Claim evidence used by complete records
  // ══════════════════════════════════════════════════════════════════

  for (const p of partials) {
    if (!p.fechaBaja || p.salarioBaseCotizacion <= 0) continue;

    // Claim bajaSalaryCombos matching this record
    for (const e of bajaSalaryCombos) {
      if (
        !e.claimed &&
        e.date.getTime() === p.fechaBaja.getTime() &&
        Math.abs(e.salary - p.salarioBaseCotizacion) < 0.1
      ) {
        e.claimed = true;
        break;
      }
    }

    // Claim bajaMovRows matching this record
    for (const e of bajaMovRows) {
      if (
        !e.claimed &&
        e.date.getTime() === p.fechaBaja.getTime() &&
        Math.abs(e.salary - p.salarioBaseCotizacion) < 0.1
      ) {
        e.claimed = true;
        break;
      }
    }

    // Claim salary entries matching this record
    for (const e of salaryEntries) {
      if (
        !e.claimed &&
        Math.abs(e.salary - p.salarioBaseCotizacion) < 0.1
      ) {
        e.claimed = true;
        break;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Phase 4: Fill incomplete records using global evidence
  // ══════════════════════════════════════════════════════════════════

  for (const p of partials) {
    if (p.fechaBaja && p.salarioBaseCotizacion > 0) continue;

    // ── Strategy G1: bajaSalaryCombos (gives both baja + salary) ──
    if (!p.fechaBaja) {
      let best: Evidence | null = null;
      let bestDist = Infinity;
      for (const e of bajaSalaryCombos) {
        if (e.claimed) continue;
        if (e.date.getTime() <= p.fechaAlta.getTime()) continue;
        const gapYears =
          (e.date.getTime() - p.fechaAlta.getTime()) / (365.25 * 86400000);
        if (gapYears > 10) continue;
        const dist = Math.abs(e.pos - p.sectionPos);
        if (dist < bestDist) {
          bestDist = dist;
          best = e;
        }
      }
      if (best) {
        p.fechaBaja = best.date;
        if (p.salarioBaseCotizacion <= 0) p.salarioBaseCotizacion = best.salary;
        best.claimed = true;
      }
    }

    // ── Strategy G2: bajaMovRows (BAJA DD/MM/YYYY $ NNN) ──
    if (!p.fechaBaja) {
      let best: Evidence | null = null;
      let bestDist = Infinity;
      for (const e of bajaMovRows) {
        if (e.claimed) continue;
        if (e.date.getTime() <= p.fechaAlta.getTime()) continue;
        const gapYears =
          (e.date.getTime() - p.fechaAlta.getTime()) / (365.25 * 86400000);
        if (gapYears > 10) continue;
        const dist = Math.abs(e.pos - p.sectionPos);
        if (dist < bestDist) {
          bestDist = dist;
          best = e;
        }
      }
      if (best) {
        p.fechaBaja = best.date;
        if (p.salarioBaseCotizacion <= 0) p.salarioBaseCotizacion = best.salary;
        best.claimed = true;
      }
    }

    // ── Strategy G3: Find alta date in movement blocks ──
    // Search for the record's alta date string in the full text (outside the
    // "Fecha de alta" header line). When found in a movement table, the first
    // date > fechaAlta in that block is the BAJA date.
    if (!p.fechaBaja && p.fechaAltaStr) {
      let searchIdx = 0;
      while (searchIdx < text.length) {
        const idx = text.indexOf(p.fechaAltaStr, searchIdx);
        if (idx === -1) break;
        searchIdx = idx + 1;

        // Skip if this is the "Fecha de alta" header occurrence
        const before = text.substring(Math.max(0, idx - 30), idx);
        if (/Fecha de alta\s*$/i.test(before)) continue;

        // Skip if this is an inline REINGRESO movement row (e.g., "REINGRESO 16/05/1985 $1.15").
        // These appear on continuation pages and their surrounding dates are MODIFICACION entries,
        // not the BAJA date we're looking for.
        if (/REINGRESO\s*$/i.test(before)) continue;

        // Look backwards for a "Fecha de movimiento" header (up to 1000 chars)
        const lookBack = text.substring(Math.max(0, idx - 1000), idx);
        const fmIdx = lookBack.lastIndexOf("Fecha de movimiento");
        if (fmIdx === -1) continue;

        // Extract all dates between the "Fecha de movimiento" header and the alta date
        const blockStart = Math.max(0, idx - 1000) + fmIdx;
        const blockText = text.substring(blockStart, idx + 15);
        const blockDates: Date[] = [];
        const bdRe = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
        let bdm;
        while ((bdm = bdRe.exec(blockText)) !== null) {
          const d = parseDate(bdm[1]);
          if (d) blockDates.push(d);
        }

        // Also check the line just before "Fecha de movimiento" for a standalone baja date
        const preBlock = text.substring(
          Math.max(0, blockStart - 80),
          blockStart
        );
        const preDateMatch = preBlock.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*$/);
        if (preDateMatch) {
          const preDate = parseDate(preDateMatch[1]);
          if (preDate) blockDates.unshift(preDate);
        }

        // The first date > fechaAlta in the block is the BAJA date
        for (const d of blockDates) {
          if (d.getTime() > p.fechaAlta.getTime()) {
            p.fechaBaja = d;
            break;
          }
        }

        if (p.fechaBaja) break;
      }
    }

    // ── Strategy G4: Find baja from "Fecha de movimiento" blocks by position ──
    // Look for unclaimed date blocks near the record's section that have dates
    // consistent with the record's era
    if (!p.fechaBaja) {
      const fmRe = /Fecha de movimiento/gi;
      let fmMatch;
      let bestBaja: Date | null = null;
      let bestDist = Infinity;

      while ((fmMatch = fmRe.exec(text)) !== null) {
        const blockPos = fmMatch.index;
        // Only consider blocks after the record's section
        if (blockPos < p.sectionPos) continue;

        // Extract dates from this block up to the NEXT "Fecha de movimiento" or "Salario Base"
        const nextFmIdx = text.indexOf("Fecha de movimiento", blockPos + 20);
        const nextSalIdx = text.indexOf("Salario Base", blockPos + 20);
        let blockEnd = blockPos + 500;
        if (nextFmIdx > 0 && nextFmIdx < blockEnd) blockEnd = nextFmIdx;
        if (nextSalIdx > 0 && nextSalIdx < blockEnd) blockEnd = nextSalIdx;
        const blockStr = text.substring(blockPos, blockEnd);
        const dates: Date[] = [];
        const dateRe = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
        let dm;
        while ((dm = dateRe.exec(blockStr)) !== null) {
          const d = parseDate(dm[1]);
          if (d) dates.push(d);
        }

        // Check if block's date range is consistent with this record
        const firstDate = dates[0];
        if (!firstDate) continue;
        if (firstDate.getTime() <= p.fechaAlta.getTime()) continue;
        const gapYears =
          (firstDate.getTime() - p.fechaAlta.getTime()) / (365.25 * 86400000);
        if (gapYears > 10) continue;

        // Check if any date in block matches or is close to alta
        const hasAltaMatch = dates.some(
          (d) =>
            Math.abs(d.getTime() - p.fechaAlta.getTime()) <
            365 * 86400000 // within 1 year
        );
        if (!hasAltaMatch && dates.length > 1) continue;

        const dist = blockPos - p.sectionPos;
        if (dist < bestDist) {
          bestDist = dist;
          bestBaja = firstDate;
        }
      }

      if (bestBaja) {
        p.fechaBaja = bestBaja;
      }
    }

    // ── Find salary if still missing ──
    if (p.salarioBaseCotizacion <= 0 && p.fechaBaja) {
      // Find the nearest unclaimed "Salario Base de Cotizacion * $ NNN" after section
      let best: SalaryEvidence | null = null;
      let bestDist = Infinity;
      for (const e of salaryEntries) {
        if (e.claimed) continue;
        // Prefer entries after the section position
        if (e.pos < p.sectionPos - 200) continue;
        const dist = Math.abs(e.pos - p.sectionPos);
        if (dist < bestDist) {
          bestDist = dist;
          best = e;
        }
      }
      if (best) {
        p.salarioBaseCotizacion = best.salary;
        best.claimed = true;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // Phase 5: Return complete records
  // ══════════════════════════════════════════════════════════════════

  return partials
    .filter((p) => p.fechaBaja && p.salarioBaseCotizacion > 0)
    .map((p) => ({
      patron: p.patron,
      registroPatronal: p.registroPatronal,
      entidadFederativa: p.entidadFederativa,
      fechaAlta: p.fechaAlta,
      fechaBaja: p.fechaBaja!,
      salarioBaseCotizacion: p.salarioBaseCotizacion,
    }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Movement extraction — extracts ALL movement rows (BAJA, REINGRESO, MOD)
// from the OCR text, handling multi-column layouts where types, dates, and
// salaries appear in separate columns rendered sequentially by OCR.
// ══════════════════════════════════════════════════════════════════════════════

const NOISE_RE =
  /^(Tipo de movimiento|Nombre del patron|Registro Patronal|Entidad|Contacto|Paseo|Col\.|C\.P\.|Tel\.|http|Pagina|gob\.mx|Instituto|GOBIERNO|MEXICO|CONAMER|IMSS|Valor|\*\s|@|\(|Estimado|Constancia|NSS|CURP|Semanas|Total|Tu |DD |Importante|Esta constancia|puede|En caso|Solo te|centro|Adicionalmente|Las semanas|Si trabaj|Si tien|nuestros|Para mayor|Aviso|La informacion|Posesion|normativas|Cadena|Sello|Secuencia|Numero de serie|Fecha de emisi)/i;

/**
 * A standalone date is a baja-header (not a movement) if the very next
 * non-blank line is "Fecha de movimiento" or "Salario Base" alone.
 */
function nextNonBlankIsBlockHeader(lines: string[], fromIdx: number): boolean {
  for (let j = fromIdx + 1; j < Math.min(fromIdx + 5, lines.length); j++) {
    const t = lines[j].trim();
    if (!t) continue;
    if (/Fecha de movimiento/i.test(t)) return true;
    if (t === "Salario Base") return true;
    return false; // something else → it's a movement date
  }
  return false;
}

function parseMovements(text: string): Movement[] {
  // ── Strategy 0: Native PDF text (date-first format, inline) ──
  // Native extraction produces "DD/MM/YYYY TYPE   $ SALARY" in continuous text.
  // This regex works for both native (inline) and OCR (newline-separated) formats.
  const nativeRe = /(\d{1,2}\/\d{1,2}\/\d{4})\s+(BAJA|REINGRESO|MODIFICACION DE SALARIO|ALTA)\s+\$\s*([\d.,]+)/g;
  const nativeMovements: Movement[] = [];
  let nm: RegExpExecArray | null;
  while ((nm = nativeRe.exec(text)) !== null) {
    const fecha = parseDate(nm[1]);
    if (fecha) {
      nativeMovements.push({
        type: nm[2] as Movement["type"],
        fecha,
        salario: parseSalary(nm[3]),
      });
    }
  }
  // If native extraction found movements, use them directly (skip page-based parsing)
  if (nativeMovements.length > 0) return nativeMovements;

  // ── Strategy 1: OCR text (type-first format, page-based) ──
  const pageChunks = text.split(/--- PAGE \d+ ---/);
  const allMovements: Movement[] = [];

  for (const pageText of pageChunks) {
    const pgLines = pageText.split("\n");

    // Pass 1: Extract full inline movements "TYPE DATE $ SALARY"
    const inlineUsed = new Set<number>();
    for (let idx = 0; idx < pgLines.length; idx++) {
      const m = pgLines[idx].match(
        /^\s*(BAJA|REINGRESO|MODIFICACION DE SALARIO)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+\$\s*([\d.,]+)/
      );
      if (m) {
        const fecha = parseDate(m[2]);
        if (fecha) {
          allMovements.push({
            type: m[1] as Movement["type"],
            fecha,
            salario: parseSalary(m[3]),
          });
          inlineUsed.add(idx);
        }
      }
    }

    // Pass 2: Collect orphan types (type alone on a line)
    const orphanTypes: { idx: number; type: Movement["type"] }[] = [];
    for (let idx = 0; idx < pgLines.length; idx++) {
      if (inlineUsed.has(idx)) continue;
      const t = pgLines[idx].trim();
      if (/^(BAJA|REINGRESO|MODIFICACION DE SALARIO)$/.test(t)) {
        orphanTypes.push({ idx, type: t as Movement["type"] });
      }
    }

    if (orphanTypes.length === 0) continue;

    // Pass 3: Collect right-column date/salary data
    const rightData: { idx: number; date: string; salary: string | null }[] = [];
    const salaryPool: { idx: number; salary: string }[] = [];
    let skipNextStandalone = 0;

    for (let idx = 0; idx < pgLines.length; idx++) {
      if (inlineUsed.has(idx)) continue;
      const t = pgLines[idx].trim();

      // "Fecha de alta" alone → skip next standalone (for the alta date value)
      if (/^Fecha de alta\s*$/.test(t)) {
        skipNextStandalone++;
        continue;
      }
      // All "Fecha de alta/baja" lines with content
      if (/^Fecha de alta\s+\d{1,2}\/\d{1,2}\/\d{4}\s+Fecha de baja\s+\d{1,2}\/\d{1,2}\/\d{4}/.test(t)) continue;
      // "Fecha de alta DD/MM/YYYY Fecha de baja" (baja missing) — don't increment
      // skip counter here; the baja header date will be caught by nextNonBlankIsBlockHeader
      if (/^Fecha de alta\s+\d{1,2}\/\d{1,2}\/\d{4}\s+Fecha de baja\s*$/.test(t)) continue;
      if (/^Fecha de (alta|baja)/.test(t)) continue;

      if (NOISE_RE.test(t)) continue;
      if (!t) continue;
      if (/^(BAJA|REINGRESO|MODIFICACION DE SALARIO)$/.test(t)) continue;
      if (/Salario Base de Cotizaci[oóéeëi]\w*\s*\*\s*\$/i.test(t)) continue;
      if (t === "Salario Base" || t === "Fecha de movimiento") continue;
      if (/Fecha de movimiento/.test(t) && /Salario/.test(t)) continue;
      // All-caps text > 5 chars (patron names)
      if (/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,\.]+$/.test(t) && t.length > 5 && !/^\d/.test(t)) continue;

      // "DD/MM/YYYY  $ NNN.NN" — always a movement row
      const mDS = t.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+\$\s*([\d.,]+)/);
      if (mDS) {
        rightData.push({ idx, date: mDS[1], salary: mDS[2] });
        continue;
      }
      // "DD/MM/YYYY Salario Base..." — header, skip
      if (/^\d{1,2}\/\d{1,2}\/\d{4}\s+Salario/.test(t)) continue;

      // Standalone date
      const mD = t.match(/^(\d{1,2}\/\d{1,2}\/\d{4})$/);
      if (mD) {
        if (skipNextStandalone > 0) { skipNextStandalone--; continue; }
        if (nextNonBlankIsBlockHeader(pgLines, idx)) continue;
        rightData.push({ idx, date: mD[1], salary: null });
        continue;
      }

      // "$ NNN.NN"
      const mS = t.match(/^\$\s*([\d.,]+)$/);
      if (mS) { salaryPool.push({ idx, salary: mS[1] }); continue; }

      // Bare number (e.g., "8.45")
      const mN = t.match(/^(\d+\.\d+)$/);
      if (mN) { salaryPool.push({ idx, salary: mN[1] }); continue; }
    }

    // Fill missing salaries from pool
    let salIdx = 0;
    for (let i = 0; i < rightData.length; i++) {
      if (rightData[i].salary === null) {
        while (salIdx < salaryPool.length && salaryPool[salIdx].idx < rightData[i].idx) {
          salIdx++;
        }
        if (salIdx < salaryPool.length) {
          rightData[i].salary = salaryPool[salIdx].salary;
          salIdx++;
        }
      }
    }

    // Zip orphan types with right_data
    for (let i = 0; i < orphanTypes.length; i++) {
      if (i < rightData.length) {
        const fecha = parseDate(rightData[i].date);
        if (fecha) {
          allMovements.push({
            type: orphanTypes[i].type,
            fecha,
            salario: rightData[i].salary ? parseSalary(rightData[i].salary!) : 0,
          });
        }
      }
    }
  }

  return allMovements;
}

/**
 * Derives salary periods from movements.
 *
 * Movements are in reverse chronological order (newest first).
 * Each REINGRESO or MODIFICACION row defines a salary period:
 *   period = fecha[i] → fecha[i-1]  (where i-1 is the more recent row)
 *
 * BAJA rows are skipped (they mark employment end; the period from
 * BAJA to the next employer's REINGRESO is a gap with no contributions).
 *
 * If no movements are available, falls back to EmploymentRecord data.
 */
function deriveSalaryPeriods(movements: Movement[], reportDate?: Date): SalaryPeriod[] {
  if (movements.length < 2) return [];

  // Step 1: Build raw periods from movements (reverse chronological)
  // Periods use the original movement dates (for AFORE calculation).
  // The salary-average module applies the -1 day adjustment separately.
  const rawPeriods: SalaryPeriod[] = [];

  // If the first movement is NOT a BAJA, the person is still employed ("Vigente").
  if (movements[0].type !== "BAJA") {
    const endDate = new Date();
    if (endDate.getTime() > movements[0].fecha.getTime()) {
      rawPeriods.push({
        fechaInicio: movements[0].fecha,
        fechaFin: endDate,
        salarioDiario: movements[0].salario,
      });
    }
  }

  for (let i = 1; i < movements.length; i++) {
    const current = movements[i];
    const prev = movements[i - 1];
    if (current.type === "BAJA") continue;
    if (prev.fecha.getTime() >= current.fecha.getTime()) {
      rawPeriods.push({
        fechaInicio: current.fecha,
        fechaFin: prev.fecha,
        salarioDiario: current.salario,
      });
    }
  }

  return rawPeriods;
}


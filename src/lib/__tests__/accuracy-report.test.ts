/**
 * REPORTE DE COINCIDENCIA vs EXCEL
 *
 * Genera un reporte detallado comparando nuestros resultados contra
 * los datos de referencia del Excel para cada persona/archivo.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { parseOCRText } from "../pdf-parser";
import { calculateAll } from "../calculations";
import type { CalculationResult } from "../calculations/types";
import fullRefs from "./full-references.json";

const DOCS = path.join(process.cwd(), "docs");

function pctNum(val: number, ref: number): number {
  if (ref === 0) return val === 0 ? 100 : 0;
  return Math.max(0, (1 - Math.abs(val - ref) / Math.abs(ref)) * 100);
}

function pctStr(n: number): string {
  return n.toFixed(2) + "%";
}

function parseRefDate(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

async function loadPdf(pdfFile: string) {
  const buf = fs.readFileSync(path.join(DOCS, pdfFile));
  const data = await pdfParse(buf);
  const parsed = parseOCRText(data.text);
  return { result: calculateAll(parsed), movCount: parsed.movements.length };
}

function loadDocx(docxFile: string) {
  const scriptPath = path.join(process.cwd(), "scripts", "extract-docx-text.py");
  const text = execSync(`python3 "${scriptPath}" "${path.join(DOCS, docxFile)}"`, { encoding: "utf-8" });
  const parsed = parseOCRText(text);
  return { result: calculateAll(parsed), movCount: parsed.movements.length };
}

interface RefEntry {
  pdf: string;
  movements: { type: string; fecha: string; salario: number }[];
  processedAltas: { type: string; fechaInicio: string; salario: number; fechaFin: string | null }[];
  salaryTable: { fechaInicio: string; fechaFin: string; salario: number; semanasTotales: number; semanasContadas: number; resultado: number }[];
  summary: { totalSemanas: number | null; semanasPromediar: number | null; promedioDiario: number | null; promedioMensual: number | null; totalResultado: number; promedioCalc: number };
}

// PDF format: simple PDFs don't have movement tables (even if the Excel has movements internally)
const SIMPLE_PDFS = new Set(["DELGADO MANCILLA JOEL.pdf", "SOLIS GARZA HECTOR RENE.pdf", "VEGA GARCIA FRANCISCO.pdf", "VEGA GARCIA FRANCISCO.docx"]);

function computeAccuracy(result: CalculationResult, ref: RefEntry, movCount: number) {
  const periods = result.salaryAverage.periods;

  // Promedio Salarial
  const ourPromedio = result.salaryAverage.promedio;
  const excelPromedio = ref.summary.promedioCalc;
  const promedioPct = pctNum(ourPromedio, excelPromedio);

  // Total Resultado (sum of semanas * salario for 250 weeks)
  const ourTotalRes = periods.reduce((s, p) => s + p.resultado, 0);
  const excelTotalRes = ref.summary.totalResultado;
  const totalResPct = pctNum(ourTotalRes, excelTotalRes);

  // Movement count (only for detallado)
  const excelMovCount = ref.movements.length;
  const movPct = excelMovCount > 0 ? pctNum(movCount, excelMovCount) : null;

  // Period-by-period: find matching rows from salary table
  let matchedPeriods = 0;
  const totalRefPeriods = ref.salaryTable.length;
  let sumResultadoErr = 0;
  let countedForRes = 0;

  for (const refRow of ref.salaryTable) {
    const refDate = parseRefDate(refRow.fechaInicio);
    // Primary: exact salary + close date. Fallback: exact salary + wider date
    // (empalme overlap resolution can shift start dates by ~22 days)
    const match = periods.find(p =>
      Math.abs(p.salarioDiario - refRow.salario) < 1 &&
      Math.abs(p.fechaAlta.getTime() - refDate.getTime()) < 16 * 86400000
    ) ?? periods.find(p =>
      Math.abs(p.salarioDiario - refRow.salario) < 0.01 &&
      Math.abs(p.fechaAlta.getTime() - refDate.getTime()) < 30 * 86400000
    );
    if (match) {
      matchedPeriods++;
      if (refRow.resultado > 0) {
        sumResultadoErr += Math.abs(match.resultado - refRow.resultado) / refRow.resultado;
        countedForRes++;
      }
    }
  }

  const periodMatchPct = totalRefPeriods > 0 ? (matchedPeriods / totalRefPeriods) * 100 : 100;
  const resultadoAvgPct = countedForRes > 0 ? (1 - sumResultadoErr / countedForRes) * 100 : 100;

  // Global: weighted average
  const w = { promedio: 40, totalRes: 25, periodos: 20, resultado: 15 };
  const global = (
    promedioPct * w.promedio +
    totalResPct * w.totalRes +
    periodMatchPct * w.periodos +
    resultadoAvgPct * w.resultado
  ) / (w.promedio + w.totalRes + w.periodos + w.resultado);

  return {
    ourPromedio, excelPromedio, promedioPct,
    ourTotalRes, excelTotalRes, totalResPct,
    movPct, movCount, excelMovCount,
    matchedPeriods, totalRefPeriods, periodMatchPct,
    resultadoAvgPct,
    global,
  };
}

describe("ACCURACY REPORT vs Excel", () => {
  it("generates comparison for all 8 files", async () => {
    const W = 88;
    const ln = (s: string) => `║  ${s.padEnd(W - 6)}  ║`;
    const sep = () => ln("─".repeat(W - 6));
    const lines: string[] = [];

    lines.push("");
    lines.push("╔" + "═".repeat(W - 2) + "╗");
    lines.push(ln("REPORTE DE COINCIDENCIA vs EXCEL — Todos los archivos".padStart((W - 6 + 53) / 2).padEnd(W - 6)));
    lines.push("╠" + "═".repeat(W - 2) + "╣");

    // ── 5 people with Excel reference ──
    const casesWithExcel: { label: string; file: string; type: "pdf" | "docx"; ref: RefEntry }[] = [
      { label: "DELGADO MANCILLA JOEL", file: "DELGADO MANCILLA JOEL.pdf", type: "pdf", ref: fullRefs.DELGADO as RefEntry },
      { label: "GARDUÑO GARCIA VILLALOBOS ARTURO", file: "GARDUÑO GARCIA VILLALOBOS ARTURO.pdf", type: "pdf", ref: fullRefs.GARDUNO as RefEntry },
      { label: "GOMEZ GORDILLO ALFREDO RAMON", file: "GOMEZ GORDILLO ALFREDO RAMON.pdf", type: "pdf", ref: fullRefs.GOMEZ as RefEntry },
      { label: "SOLIS GARZA HECTOR RENE", file: "SOLIS GARZA HECTOR RENE.pdf", type: "pdf", ref: fullRefs.SOLIS as RefEntry },
      { label: "VEGA GARCIA FRANCISCO", file: "VEGA GARCIA FRANCISCO.pdf", type: "pdf", ref: fullRefs.VEGA as RefEntry },
      { label: "VEGA GARCIA FRANCISCO (DOCX)", file: "VEGA GARCIA FRANCISCO.docx", type: "docx", ref: fullRefs.VEGA as RefEntry },
    ];

    const globals: number[] = [];

    for (const c of casesWithExcel) {
      const { result, movCount } = c.type === "pdf"
        ? await loadPdf(c.file)
        : loadDocx(c.file);
      const a = computeAccuracy(result, c.ref, movCount);
      globals.push(a.global);

      const isSimple = SIMPLE_PDFS.has(c.file);
      const fmt = isSimple ? "simple" : "detallado";
      lines.push(ln(""));
      lines.push(ln(`${c.label} [${fmt}, ${c.type.toUpperCase()}]`));
      lines.push(sep());
      lines.push(ln(`  Promedio Salarial:   $${a.ourPromedio.toFixed(2).padStart(10)}  vs Excel $${a.excelPromedio.toFixed(2).padStart(10)}   →  ${pctStr(a.promedioPct).padStart(8)}`));
      lines.push(ln(`  Total Resultado:     $${a.ourTotalRes.toFixed(2).padStart(10)}  vs Excel $${a.excelTotalRes.toFixed(2).padStart(10)}   →  ${pctStr(a.totalResPct).padStart(8)}`));
      lines.push(ln(`  Periodos matched:     ${a.matchedPeriods}/${a.totalRefPeriods}${" ".repeat(36)}→  ${pctStr(a.periodMatchPct).padStart(8)}`));
      lines.push(ln(`  Resultado/periodo:${" ".repeat(47)}→  ${pctStr(a.resultadoAvgPct).padStart(8)}`));
      if (!isSimple && a.movPct !== null) {
        lines.push(ln(`  Movimientos:          ${a.movCount}/${a.excelMovCount}${" ".repeat(36)}→  ${pctStr(a.movPct).padStart(8)}`));
      }
      lines.push(ln(`  ▶ COINCIDENCIA GLOBAL:${" ".repeat(43)}   ${pctStr(a.global).padStart(8)}`));
    }

    // ── GONZALEZ — no Excel, reference promedio only ──
    const gonzCases: { label: string; file: string; type: "pdf" | "docx" }[] = [
      { label: "GONZALEZ VAZQUEZ OCTAVIO", file: "GONZALEZ VAZQUEZ OCTAVIO.pdf", type: "pdf" },
      { label: "GONZALEZ VAZQUEZ OCTAVIO (DOCX)", file: "GONZALEZ VAZQUEZ OCTAVIO.docx", type: "docx" },
    ];

    for (const c of gonzCases) {
      const { result, movCount } = c.type === "pdf"
        ? await loadPdf(c.file)
        : loadDocx(c.file);
      const refPromedio = 1241.56;
      const promPct = pctNum(result.salaryAverage.promedio, refPromedio);
      globals.push(promPct);

      lines.push(ln(""));
      lines.push(ln(`${c.label} [detallado, ${c.type.toUpperCase()}] — sin Excel`));
      lines.push(sep());
      lines.push(ln(`  Promedio Salarial:   $${result.salaryAverage.promedio.toFixed(2).padStart(10)}  vs Ref    $${refPromedio.toFixed(2).padStart(10)}   →  ${pctStr(promPct).padStart(8)}`));
      lines.push(ln(`  Movimientos extraídos: ${movCount}`));
      lines.push(ln(`  ▶ COINCIDENCIA GLOBAL:${" ".repeat(43)}   ${pctStr(promPct).padStart(8)}`));
    }

    // ── Summary ──
    const avgGlobal = globals.reduce((s, v) => s + v, 0) / globals.length;
    lines.push(ln(""));
    lines.push("╠" + "═".repeat(W - 2) + "╣");
    lines.push(ln(`  PROMEDIO GLOBAL (${globals.length} archivos):${" ".repeat(33)}   ${pctStr(avgGlobal).padStart(8)}`));
    lines.push(ln(""));
    lines.push(ln("  Archivos probados:"));
    lines.push(ln("    PDF  simple:    DELGADO, SOLIS, VEGA"));
    lines.push(ln("    PDF  detallado: GARDUÑO, GOMEZ, GONZALEZ"));
    lines.push(ln("    DOCX simple:    VEGA"));
    lines.push(ln("    DOCX detallado: GONZALEZ"));
    lines.push("╚" + "═".repeat(W - 2) + "╝");

    console.log(lines.join("\n"));

    // Verify all are above 98%
    for (let i = 0; i < globals.length; i++) {
      expect(globals[i]).toBeGreaterThan(98);
    }
  });
});

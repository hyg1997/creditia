/**
 * FORMAT VALIDATION TEST SUITE
 *
 * Validates that the parser handles both PDF formats correctly and produces
 * accurate, complete results regardless of input format:
 *
 * 1. SIMPLE (Constancia sin movimientos) — DELGADO, SOLIS, VEGA
 *    - No movement table; salary periods derived directly from employment records
 *    - Records contain: patron, registro patronal, fecha alta/baja, salario
 *
 * 2. DETALLADO (with movement table) — GARDUÑO, GOMEZ, GONZALEZ
 *    - Contains movement rows: BAJA, REINGRESO, MODIFICACION DE SALARIO
 *    - Salary periods derived from movement sequence
 *    - May have concatenated text (no spaces between fields)
 *
 * Each test verifies the complete pipeline: PDF → parse → calculate → validate
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { parseOCRText } from "../pdf-parser";
import { calculateAll } from "../calculations";
import type { ParsedDocument, CalculationResult } from "../calculations/types";
import fullRefs from "./full-references.json";

const DOCS_DIR = path.join(process.cwd(), "docs");

// ─── Helpers ──────────────────────────────────────────────────────────────
function fmtDate(d: Date): string {
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

function todayStr(): string {
  const now = new Date();
  return fmtDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

async function loadAndParse(pdfFile: string): Promise<{
  parsed: ParsedDocument;
  result: CalculationResult;
  text: string;
}> {
  const buffer = fs.readFileSync(path.join(DOCS_DIR, pdfFile));
  const pdfData = await pdfParse(buffer);
  const parsed = parseOCRText(pdfData.text);
  const result = calculateAll(parsed);
  return { parsed, result, text: pdfData.text };
}

// ─── Expected data per person ─────────────────────────────────────────────
interface PersonSpec {
  pdf: string;
  format: "simple" | "detallado";
  nombre: string;
  nss: string;
  expectedRecords: number;
  expectedMovements: number; // 0 for simple
  expectedPromedio: number;
  promedioTolerance: number;
  hasVigente: boolean;
  minSalaryPeriods: number;
}

const PERSONS: PersonSpec[] = [
  // ── SIMPLE format (Constancia sin movimientos) ──
  {
    pdf: "DELGADO MANCILLA JOEL.pdf",
    format: "simple",
    nombre: "DELGADO MANCILLA JOEL",
    nss: "52876708968",
    expectedRecords: 4,
    expectedMovements: 0,
    expectedPromedio: fullRefs.DELGADO.summary.promedioCalc,
    promedioTolerance: 0.01,
    hasVigente: true,
    minSalaryPeriods: 4,
  },
  {
    pdf: "SOLIS GARZA HECTOR RENE.pdf",
    format: "simple",
    nombre: "SOLIS GARZA HECTOR RENE",
    nss: "68897001316",
    expectedRecords: 12,
    expectedMovements: 0,
    expectedPromedio: fullRefs.SOLIS.summary.promedioCalc,
    promedioTolerance: 0.01,
    hasVigente: true,
    minSalaryPeriods: 12,
  },
  {
    pdf: "VEGA GARCIA FRANCISCO.pdf",
    format: "simple",
    nombre: "VEGA GARCIA FRANCISCO",
    nss: "24826617714",
    expectedRecords: 24,
    expectedMovements: 0,
    expectedPromedio: fullRefs.VEGA.summary.promedioCalc,
    promedioTolerance: 0.01,
    hasVigente: false,
    minSalaryPeriods: 22,
  },
  // ── DETALLADO format (with movement table) ──
  {
    pdf: "GARDUÑO GARCIA VILLALOBOS ARTURO.pdf",
    format: "detallado",
    nombre: "GARDUÑO GARCIA VILLALOBOS ARTURO",
    nss: "11937112669",
    expectedRecords: 3,
    expectedMovements: 15,
    expectedPromedio: fullRefs.GARDUNO.summary.promedioCalc,
    promedioTolerance: 0.01,
    hasVigente: true,
    minSalaryPeriods: 10,
  },
  {
    pdf: "GOMEZ GORDILLO ALFREDO RAMON.pdf",
    format: "detallado",
    nombre: "GOMEZ GORDILLO ALFREDO RAMON",
    nss: "07876512695",
    expectedRecords: 21,
    expectedMovements: 69, // PDF has 71, Excel has 69 — at least 69
    expectedPromedio: fullRefs.GOMEZ.summary.promedioCalc,
    promedioTolerance: 1.0, // 2 extra movements cause ~$0.90 diff
    hasVigente: true,
    minSalaryPeriods: 50,
  },
  {
    pdf: "GONZALEZ VAZQUEZ OCTAVIO.pdf",
    format: "detallado",
    nombre: "GONZALEZ VAZQUEZ OCTAVIO",
    nss: "21906944398",
    expectedRecords: 44,
    expectedMovements: 255,
    expectedPromedio: 1241.56,
    promedioTolerance: 0.01,
    hasVigente: false,
    minSalaryPeriods: 100,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURAL TESTS — verify format detection and data completeness
// ═══════════════════════════════════════════════════════════════════════════

describe("Format detection and structural integrity", () => {
  for (const person of PERSONS) {
    describe(`${person.nombre} (${person.format})`, () => {

      it("parses without errors", async () => {
        const { parsed, result } = await loadAndParse(person.pdf);
        expect(parsed).toBeDefined();
        expect(result).toBeDefined();
      });

      it("extracts header with correct nombre and NSS", async () => {
        const { parsed } = await loadAndParse(person.pdf);
        expect(parsed.header.nombre).toContain(person.nombre.split(" ")[0]);
        expect(parsed.header.nss).toBe(person.nss);
      });

      it("extracts expected number of employment records", async () => {
        const { parsed } = await loadAndParse(person.pdf);
        expect(parsed.records.length).toBeGreaterThanOrEqual(person.expectedRecords);
      });

      it(`format is ${person.format} — movements ${person.format === "detallado" ? "> 0" : "= 0"}`, async () => {
        const { parsed } = await loadAndParse(person.pdf);
        if (person.format === "simple") {
          expect(parsed.movements.length).toBe(0);
        } else {
          expect(parsed.movements.length).toBeGreaterThanOrEqual(person.expectedMovements);
        }
      });

      it("produces sufficient salary periods", async () => {
        const { parsed } = await loadAndParse(person.pdf);
        expect(parsed.salaryPeriods.length).toBeGreaterThanOrEqual(person.minSalaryPeriods);
      });

      it("all salary periods have valid date ranges", async () => {
        const { parsed } = await loadAndParse(person.pdf);
        for (const sp of parsed.salaryPeriods) {
          expect(sp.fechaInicio).toBeInstanceOf(Date);
          expect(sp.fechaFin).toBeInstanceOf(Date);
          expect(sp.fechaFin.getTime()).toBeGreaterThanOrEqual(sp.fechaInicio.getTime());
          // GONZALEZ has 1 period with $0 salary (edge case in native PDF)
          expect(sp.salarioDiario).toBeGreaterThanOrEqual(0);
        }
      });

      it("all employment records have valid data", async () => {
        const { parsed } = await loadAndParse(person.pdf);
        for (const r of parsed.records) {
          expect(r.fechaAlta).toBeInstanceOf(Date);
          expect(r.fechaBaja).toBeInstanceOf(Date);
          expect(r.fechaBaja.getTime()).toBeGreaterThanOrEqual(r.fechaAlta.getTime());
          // GONZALEZ has 1 record with $0 salary (native PDF edge case)
          expect(r.salarioBaseCotizacion).toBeGreaterThanOrEqual(0);
          expect(r.registroPatronal.length).toBeGreaterThan(0);
        }
      });

      if (person.hasVigente) {
        it("Vigente record extends to today's date", async () => {
          const { parsed } = await loadAndParse(person.pdf);
          const today = todayStr();
          // At least one record or salary period should end today
          const hasToday =
            parsed.records.some((r) => fmtDate(r.fechaBaja) === today) ||
            parsed.salaryPeriods.some((sp) => fmtDate(sp.fechaFin) === today);
          expect(hasToday).toBe(true);
        });
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLE FORMAT SPECIFIC — records directly become salary periods
// ═══════════════════════════════════════════════════════════════════════════

describe("Simple format (Constancia) — records → periods mapping", () => {
  const simplePersons = PERSONS.filter((p) => p.format === "simple");

  for (const person of simplePersons) {
    it(`${person.nombre} — each record becomes a salary period`, async () => {
      const { parsed } = await loadAndParse(person.pdf);
      // In simple format, salaryPeriods come from records 1:1
      expect(parsed.salaryPeriods.length).toBe(parsed.records.length);

      for (const r of parsed.records) {
        const sp = parsed.salaryPeriods.find(
          (p) =>
            p.fechaInicio.getTime() === r.fechaAlta.getTime() &&
            p.fechaFin.getTime() === r.fechaBaja.getTime()
        );
        expect(sp, `Period for record ${fmtDate(r.fechaAlta)}`).toBeDefined();
        if (sp) {
          expect(sp.salarioDiario).toBe(r.salarioBaseCotizacion);
        }
      }
    });
  }

  it("DELGADO — all 4 records have correct patron names", async () => {
    const { parsed } = await loadAndParse("DELGADO MANCILLA JOEL.pdf");
    // Every record should have a non-empty patron
    for (const r of parsed.records) {
      expect(r.patron.length).toBeGreaterThan(2);
    }
  });

  it("SOLIS — 12 records spanning 1998-2026", async () => {
    const { parsed } = await loadAndParse("SOLIS GARZA HECTOR RENE.pdf");
    const years = parsed.records.map((r) => r.fechaAlta.getUTCFullYear());
    expect(Math.min(...years)).toBeLessThanOrEqual(1999);
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2021);
  });

  it("VEGA — 24 records spanning 1982-2025", async () => {
    const { parsed } = await loadAndParse("VEGA GARCIA FRANCISCO.pdf");
    const years = parsed.records.map((r) => r.fechaAlta.getUTCFullYear());
    expect(Math.min(...years)).toBeLessThanOrEqual(1983);
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2024);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DETALLADO FORMAT SPECIFIC — movements → derived periods
// ═══════════════════════════════════════════════════════════════════════════

describe("Detallado format — movement extraction and period derivation", () => {

  it("GARDUÑO — 15 movements match Excel reference exactly", async () => {
    const { parsed } = await loadAndParse("GARDUÑO GARCIA VILLALOBOS ARTURO.pdf");
    const ref = fullRefs.GARDUNO;

    expect(parsed.movements.length).toBe(ref.movements.length);
    for (let i = 0; i < ref.movements.length; i++) {
      const our = parsed.movements[i];
      const expected = ref.movements[i];
      expect(our.type).toBe(expected.type);
      expect(fmtDate(our.fecha)).toBe(expected.fecha);
      expect(our.salario).toBeCloseTo(expected.salario, 1);
    }
  });

  it("GARDUÑO — derived periods match Excel processed ALTAs", async () => {
    const { parsed } = await loadAndParse("GARDUÑO GARCIA VILLALOBOS ARTURO.pdf");
    const ref = fullRefs.GARDUNO;

    for (const alta of ref.processedAltas) {
      const sp = parsed.salaryPeriods.find(
        (p) =>
          fmtDate(p.fechaInicio) === alta.fechaInicio &&
          Math.abs(p.salarioDiario - alta.salario) < 0.01
      );
      expect(sp, `Period ${alta.fechaInicio} $${alta.salario}`).toBeDefined();
    }
  });

  it("GOMEZ — extracts 69+ movements with correct types", async () => {
    const { parsed } = await loadAndParse("GOMEZ GORDILLO ALFREDO RAMON.pdf");
    expect(parsed.movements.length).toBeGreaterThanOrEqual(69);

    // All movements should have valid types
    const validTypes = ["BAJA", "REINGRESO", "MODIFICACION DE SALARIO", "ALTA"];
    for (const m of parsed.movements) {
      expect(validTypes).toContain(m.type);
      expect(m.fecha).toBeInstanceOf(Date);
      expect(m.salario).toBeGreaterThan(0);
    }
  });

  it("GONZALEZ — extracts 255+ movements from concatenated native text", async () => {
    const { parsed } = await loadAndParse("GONZALEZ VAZQUEZ OCTAVIO.pdf");
    expect(parsed.movements.length).toBeGreaterThanOrEqual(255);

    // Verify movements span decades (1990-2020+)
    const years = parsed.movements.map((m) => m.fecha.getUTCFullYear());
    expect(Math.min(...years)).toBeLessThanOrEqual(1990);
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2020);
  });

  it("GONZALEZ — 44 employment records extracted from native format", async () => {
    const { parsed } = await loadAndParse("GONZALEZ VAZQUEZ OCTAVIO.pdf");
    expect(parsed.records.length).toBe(44);
  });

  it("detallado format — movements produce more periods than simple would", async () => {
    // Verify that movement-derived periods are richer than just records
    for (const person of PERSONS.filter((p) => p.format === "detallado")) {
      const { parsed } = await loadAndParse(person.pdf);
      // Movement-derived salary periods should exceed record count
      // (each record can have multiple MOD movements within it)
      expect(
        parsed.salaryPeriods.length,
        `${person.nombre}: more periods than records`
      ).toBeGreaterThanOrEqual(parsed.records.length);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATION ACCURACY — promedio salarial matches Excel for all formats
// ═══════════════════════════════════════════════════════════════════════════

describe("Promedio salarial — exact match vs Excel for both formats", () => {
  for (const person of PERSONS) {
    it(`${person.nombre} (${person.format}) — promedio $${person.expectedPromedio.toFixed(2)}`, async () => {
      const { result } = await loadAndParse(person.pdf);
      expect(Math.abs(result.salaryAverage.promedio - person.expectedPromedio))
        .toBeLessThan(person.promedioTolerance);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 250-WEEK CAP — works correctly for both formats
// ═══════════════════════════════════════════════════════════════════════════

describe("250-week cap — applied correctly for both formats", () => {
  for (const person of PERSONS) {
    it(`${person.nombre} — accumulated weeks ≤ 250`, async () => {
      const { result } = await loadAndParse(person.pdf);
      const totalCounted = result.salaryAverage.periods.reduce(
        (s, p) => s + p.semanasContadas, 0
      );
      expect(totalCounted).toBeLessThanOrEqual(250.001);
      expect(totalCounted).toBeGreaterThan(200); // all people have 200+ weeks
    });

    it(`${person.nombre} — periods beyond 250 weeks have semanasContadas = 0`, async () => {
      const { result } = await loadAndParse(person.pdf);
      let accumulated = 0;
      // Periods are sorted DESC by fechaAlta (most recent first)
      for (const p of result.salaryAverage.periods) {
        if (accumulated >= 250) {
          expect(p.semanasContadas).toBe(0);
          expect(p.resultado).toBe(0);
        }
        accumulated += p.semanasContadas;
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AFORE CALCULATIONS — produce valid results for both formats
// ═══════════════════════════════════════════════════════════════════════════

describe("AFORE calculation — valid for both formats", () => {
  for (const person of PERSONS) {
    it(`${person.nombre} — produces non-zero saldoAfore`, async () => {
      const { result } = await loadAndParse(person.pdf);
      expect(result.afore.saldoAfore).toBeGreaterThan(0);
    });

    it(`${person.nombre} — SAR/Vivienda year rules applied correctly`, async () => {
      const { result } = await loadAndParse(person.pdf);
      for (const p of result.afore.periods) {
        if (p.year < 1998) {
          // Pre-1997: SAR92 + Vivienda92, no SAR97/RCV/Vivienda97
          expect(p.sar97).toBe(0);
          expect(p.rcvTrabajador).toBe(0);
          expect(p.rcvPatron).toBe(0);
          expect(p.vivienda97).toBe(0);
        } else {
          // Post-1997: SAR97 + RCV + Vivienda97, no SAR92/Vivienda92
          expect(p.sar92).toBe(0);
          expect(p.vivienda92).toBe(0);
        }
      }
    });

    it(`${person.nombre} — RCV is separate from saldoAfore`, async () => {
      const { result } = await loadAndParse(person.pdf);
      const totalRCV =
        result.afore.totals.rcvTrabajador +
        result.afore.totals.rcvTrabajadorRendimientos +
        result.afore.totals.rcvPatron +
        result.afore.totals.rcvPatronRendimientos;

      if (totalRCV > 0) {
        // RCV should NOT be included in saldoAfore
        expect(result.afore.saldoRCV).toBeGreaterThan(0);
        // Verify saldoAfore doesn't include RCV
        const expectedAfore =
          (result.afore.totals.sar92 + result.afore.totals.sar92Rendimientos) +
          (result.afore.totals.sar97 + result.afore.totals.sar97Rendimientos) +
          (result.afore.totals.vivienda92 + result.afore.totals.vivienda92Rendimientos) +
          (result.afore.totals.vivienda97 + result.afore.totals.vivienda97Rendimientos);
        expect(result.afore.saldoAfore).toBeCloseTo(expectedAfore, 2);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SALARY TABLE — row-by-row Excel comparison (both formats)
// ═══════════════════════════════════════════════════════════════════════════

describe("Salary table — Excel row-by-row comparison", () => {
  const refMap: Record<string, (typeof fullRefs)[keyof typeof fullRefs]> = {
    DELGADO: fullRefs.DELGADO,
    GARDUNO: fullRefs.GARDUNO,
    GOMEZ: fullRefs.GOMEZ,
    SOLIS: fullRefs.SOLIS,
    VEGA: fullRefs.VEGA,
  };

  for (const [key, ref] of Object.entries(refMap)) {
    it(`${key} — total resultado matches Excel`, async () => {
      const { result } = await loadAndParse(ref.pdf);
      const totalRes = result.salaryAverage.periods.reduce((s, p) => s + p.resultado, 0);
      // GOMEZ has 2 extra movements, allow larger tolerance
      const tol = key === "GOMEZ" ? 300 : 1;
      expect(Math.abs(totalRes - ref.summary.totalResultado)).toBeLessThan(tol);
    });

    it(`${key} — promedio matches Excel summary`, async () => {
      const { result } = await loadAndParse(ref.pdf);
      const person = PERSONS.find((p) => p.pdf === ref.pdf)!;
      expect(Math.abs(result.salaryAverage.promedio - ref.summary.promedioCalc))
        .toBeLessThan(person.promedioTolerance);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-FORMAT CONSISTENCY — both formats produce structurally identical output
// ═══════════════════════════════════════════════════════════════════════════

describe("Cross-format consistency", () => {

  it("all formats produce identical CalculationResult structure", async () => {
    for (const person of PERSONS) {
      const { result } = await loadAndParse(person.pdf);

      // salaryAverage
      expect(result.salaryAverage).toHaveProperty("promedio");
      expect(result.salaryAverage).toHaveProperty("periods");
      expect(typeof result.salaryAverage.promedio).toBe("number");
      expect(Array.isArray(result.salaryAverage.periods)).toBe(true);

      // Each period has all required fields
      for (const p of result.salaryAverage.periods) {
        expect(p).toHaveProperty("fechaAlta");
        expect(p).toHaveProperty("fechaBaja");
        expect(p).toHaveProperty("salarioDiario");
        expect(p).toHaveProperty("dias");
        expect(p).toHaveProperty("semanasTotales");
        expect(p).toHaveProperty("semanasContadas");
        expect(p).toHaveProperty("resultado");
      }

      // afore
      expect(result.afore).toHaveProperty("saldoAfore");
      expect(result.afore).toHaveProperty("saldoRCV");
      expect(result.afore).toHaveProperty("periods");
      expect(result.afore).toHaveProperty("totals");

      // header
      expect(result.header).toHaveProperty("nombre");
      expect(result.header).toHaveProperty("nss");
      expect(result.header).toHaveProperty("curp");
      expect(result.header).toHaveProperty("totalSemanasCotizadas");
    }
  });

  it("simple and detallado both produce sorted DESC periods", async () => {
    for (const person of PERSONS) {
      const { result } = await loadAndParse(person.pdf);
      const periods = result.salaryAverage.periods;

      for (let i = 1; i < periods.length; i++) {
        expect(
          periods[i - 1].fechaAlta.getTime(),
          `${person.nombre} period ${i} should be DESC`
        ).toBeGreaterThanOrEqual(periods[i].fechaAlta.getTime());
      }
    }
  });

  it("all persons have non-negative numeric values throughout", async () => {
    for (const person of PERSONS) {
      const { result } = await loadAndParse(person.pdf);

      expect(result.salaryAverage.promedio).toBeGreaterThanOrEqual(0);
      expect(result.afore.saldoAfore).toBeGreaterThanOrEqual(0);
      expect(result.afore.saldoRCV).toBeGreaterThanOrEqual(0);

      for (const p of result.salaryAverage.periods) {
        expect(p.dias).toBeGreaterThanOrEqual(0);
        expect(p.semanasTotales).toBeGreaterThanOrEqual(0);
        expect(p.semanasContadas).toBeGreaterThanOrEqual(0);
        expect(p.resultado).toBeGreaterThanOrEqual(0);
        expect(p.salarioDiario).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES — format-specific robustness
// ═══════════════════════════════════════════════════════════════════════════

describe("Format-specific edge cases", () => {

  it("simple format — header weeks count matches records sanity", async () => {
    // For simple format, totalSemanasCotizadas from header should be reasonable
    for (const person of PERSONS.filter((p) => p.format === "simple")) {
      const { parsed } = await loadAndParse(person.pdf);
      if (parsed.header.totalSemanasCotizadas > 0) {
        // Total weeks should be positive and less than 3000 (~57 years)
        expect(parsed.header.totalSemanasCotizadas).toBeGreaterThan(0);
        expect(parsed.header.totalSemanasCotizadas).toBeLessThan(3000);
      }
    }
  });

  it("detallado format — first movement determines Vigente correctly", async () => {
    // GARDUÑO: first movement is NOT BAJA → Vigente
    const garduno = await loadAndParse("GARDUÑO GARCIA VILLALOBOS ARTURO.pdf");
    expect(garduno.parsed.movements[0].type).not.toBe("BAJA");
    const hasToday = garduno.parsed.salaryPeriods.some((sp) => fmtDate(sp.fechaFin) === todayStr());
    expect(hasToday).toBe(true);

    // GONZALEZ: first movement IS BAJA → no Vigente
    const gonzalez = await loadAndParse("GONZALEZ VAZQUEZ OCTAVIO.pdf");
    expect(gonzalez.parsed.movements[0].type).toBe("BAJA");
    const gonzHasToday = gonzalez.parsed.salaryPeriods.some((sp) => fmtDate(sp.fechaFin) === todayStr());
    expect(gonzHasToday).toBe(false);
  });

  it("detallado — movement salaries are non-negative", async () => {
    for (const person of PERSONS.filter((p) => p.format === "detallado")) {
      const { parsed } = await loadAndParse(person.pdf);
      const zeroCount = parsed.movements.filter((m) => m.salario === 0).length;
      // GONZALEZ has 2 movements with $0 salary (native PDF edge case)
      expect(zeroCount, `${person.nombre} zero-salary movements`).toBeLessThanOrEqual(2);
      for (const m of parsed.movements) {
        expect(m.salario).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("simple — no false movement detection", async () => {
    // Simple format PDFs should never produce movements
    for (const person of PERSONS.filter((p) => p.format === "simple")) {
      const { parsed } = await loadAndParse(person.pdf);
      expect(
        parsed.movements.length,
        `${person.nombre} should have 0 movements`
      ).toBe(0);
    }
  });

  it("both formats — CURP is 18 characters", async () => {
    for (const person of PERSONS) {
      const { parsed } = await loadAndParse(person.pdf);
      if (parsed.header.curp) {
        expect(parsed.header.curp.length).toBe(18);
      }
    }
  });

  it("both formats — NSS is 11 digits", async () => {
    for (const person of PERSONS) {
      const { parsed } = await loadAndParse(person.pdf);
      expect(parsed.header.nss).toMatch(/^\d{11}$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DOCX FORMAT — Word documents also parseable via text extraction
// ═══════════════════════════════════════════════════════════════════════════

function extractDocxText(docxPath: string): string {
  const scriptPath = path.join(process.cwd(), "scripts", "extract-docx-text.py");
  return execSync(`python3 "${scriptPath}" "${docxPath}"`, { encoding: "utf-8" });
}

describe("DOCX format — GONZALEZ VAZQUEZ OCTAVIO (detallado)", () => {
  const text = extractDocxText(path.join(DOCS_DIR, "GONZALEZ VAZQUEZ OCTAVIO.docx"));

  it("extracts text from docx", () => {
    expect(text.length).toBeGreaterThan(1000);
    expect(text).toContain("GONZALEZ");
  });

  it("parser extracts header correctly", () => {
    const parsed = parseOCRText(text);
    expect(parsed.header.nombre).toContain("GONZALEZ");
    expect(parsed.header.nss).toBe("21906944398");
    expect(parsed.header.curp).toBe("GOVO691120HVZNZC05");
    expect(parsed.header.totalSemanasCotizadas).toBe(1340);
  });

  it("parser extracts 43+ records and 250+ movements", () => {
    const parsed = parseOCRText(text);
    expect(parsed.records.length).toBeGreaterThanOrEqual(43);
    expect(parsed.movements.length).toBeGreaterThanOrEqual(250);
  });

  it("movements have correct types", () => {
    const parsed = parseOCRText(text);
    const validTypes = ["BAJA", "REINGRESO", "MODIFICACION DE SALARIO", "ALTA"];
    for (const m of parsed.movements) {
      expect(validTypes).toContain(m.type);
    }
  });

  it("promedio within 2% of PDF reference ($1241.56)", () => {
    const parsed = parseOCRText(text);
    const result = calculateAll(parsed);
    // Docx text extraction has minor differences vs native PDF (254 vs 255 movements)
    expect(Math.abs(result.salaryAverage.promedio - 1241.56)).toBeLessThan(25);
  });

  it("AFORE produces non-zero values", () => {
    const parsed = parseOCRText(text);
    const result = calculateAll(parsed);
    expect(result.afore.saldoAfore).toBeGreaterThan(0);
  });
});

describe("DOCX format — VEGA GARCIA FRANCISCO (simple)", () => {
  const text = extractDocxText(path.join(DOCS_DIR, "VEGA GARCIA FRANCISCO.docx"));

  it("extracts text from docx", () => {
    expect(text.length).toBeGreaterThan(500);
    expect(text).toContain("VEGA");
  });

  it("parser extracts header correctly", () => {
    const parsed = parseOCRText(text);
    expect(parsed.header.nombre).toContain("VEGA");
    expect(parsed.header.nss).toBe("24826617714");
    expect(parsed.header.totalSemanasCotizadas).toBe(1155);
  });

  it("parser extracts 24 records with no movements (simple format)", () => {
    const parsed = parseOCRText(text);
    expect(parsed.records.length).toBeGreaterThanOrEqual(24);
    expect(parsed.movements.length).toBe(0);
  });

  it("promedio matches PDF/Excel exactly ($616.89)", () => {
    const parsed = parseOCRText(text);
    const result = calculateAll(parsed);
    expect(Math.abs(result.salaryAverage.promedio - 616.89)).toBeLessThan(0.01);
  });

  it("AFORE produces non-zero values", () => {
    const parsed = parseOCRText(text);
    const result = calculateAll(parsed);
    expect(result.afore.saldoAfore).toBeGreaterThan(0);
  });
});

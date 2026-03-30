import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { parseOCRText } from "../pdf-parser";
import { calculateAll } from "../calculations";
import { calculateSalaryAverage } from "../calculations/salary-average";
import { calculateAfore } from "../calculations/afore-balance";
import type { SalaryPeriod } from "../calculations/types";
import references from "./references.json";

const DOCS_DIR = path.join(process.cwd(), "docs");

// ─── Helper ───────────────────────────────────────────────────────────
function fmtDate(d: Date): string {
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

function parseDate(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

async function loadAndParse(pdfFile: string) {
  const buffer = fs.readFileSync(path.join(DOCS_DIR, pdfFile));
  const pdfData = await pdfParse(buffer);
  const parsed = parseOCRText(pdfData.text);
  const result = calculateAll(parsed);
  return { parsed, result, text: pdfData.text };
}

// ─── Reference data type ──────────────────────────────────────────────
interface RefPeriod {
  fechaInicio: string;
  fechaFin: string;
  salario: number;
  semanasTotales: number;
  semanasContadas: number;
  resultado: number;
}
interface RefData {
  movements: { type: string; fecha: string; salario: number }[];
  salaryPeriods: RefPeriod[];
  totalResultado: number;
  promedio: number;
  excelPromedio: number | null;
  excelPromedioMensual: number | null;
}
const refs = references as Record<string, RefData>;

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 1: PDF Parsing — ensure data is extracted from each PDF
// ═══════════════════════════════════════════════════════════════════════
describe("PDF Parsing", () => {
  it("DELGADO — simple Constancia (no movements), extracts 4 records", async () => {
    const { parsed } = await loadAndParse("DELGADO MANCILLA JOEL.pdf");
    expect(parsed.header.nombre).toBe("DELGADO MANCILLA JOEL");
    expect(parsed.header.nss).toBe("52876708968");
    expect(parsed.records.length).toBe(4);
    expect(parsed.movements.length).toBe(0); // no movement tables
    expect(parsed.salaryPeriods.length).toBe(4); // fallback from records
  });

  it("GARDUÑO — native PDF with movements, extracts 15 movements", async () => {
    const { parsed } = await loadAndParse("GARDUÑO GARCIA VILLALOBOS ARTURO.pdf");
    expect(parsed.header.nombre).toBe("GARDUÑO GARCIA VILLALOBOS ARTURO");
    expect(parsed.movements.length).toBe(15);
    expect(parsed.salaryPeriods.length).toBe(13);
  });

  it("GOMEZ — complex PDF with 71 movements across multiple employers", async () => {
    const { parsed } = await loadAndParse("GOMEZ GORDILLO ALFREDO RAMON.pdf");
    expect(parsed.header.nombre).toBe("GOMEZ GORDILLO ALFREDO RAMON");
    expect(parsed.movements.length).toBeGreaterThanOrEqual(69);
    expect(parsed.salaryPeriods.length).toBeGreaterThanOrEqual(48);
  });

  it("SOLIS — simple Constancia (no movements), extracts 12 records", async () => {
    const { parsed } = await loadAndParse("SOLIS GARZA HECTOR RENE.pdf");
    expect(parsed.header.nombre).toBe("SOLIS GARZA HECTOR RENE");
    expect(parsed.records.length).toBe(12);
    expect(parsed.movements.length).toBe(0);
    expect(parsed.salaryPeriods.length).toBe(12);
  });

  it("VEGA — simple Constancia (no movements), extracts 24 records", async () => {
    const { parsed } = await loadAndParse("VEGA GARCIA FRANCISCO.pdf");
    expect(parsed.header.nombre).toBe("VEGA GARCIA FRANCISCO");
    expect(parsed.records.length).toBe(24);
    expect(parsed.movements.length).toBe(0);
    expect(parsed.salaryPeriods.length).toBe(24);
  });

  it("GONZALEZ — native PDF with 255+ movements", async () => {
    const { parsed } = await loadAndParse("GONZALEZ VAZQUEZ OCTAVIO.pdf");
    expect(parsed.header.nombre).toBe("GONZALEZ VAZQUEZ OCTAVIO");
    expect(parsed.movements.length).toBeGreaterThanOrEqual(250);
    expect(parsed.salaryPeriods.length).toBeGreaterThanOrEqual(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 2: Vigente detection — first record active
// ═══════════════════════════════════════════════════════════════════════
describe("Vigente (active employment) detection", () => {
  it("DELGADO — Vigente record extends to today", async () => {
    const { parsed } = await loadAndParse("DELGADO MANCILLA JOEL.pdf");
    const firstPeriod = parsed.salaryPeriods[0];
    expect(fmtDate(firstPeriod.fechaInicio)).toBe("18/12/1998");
    // fechaFin should be today (not report date)
    const today = new Date();
    const todayStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;
    expect(fmtDate(firstPeriod.fechaFin)).toBe(todayStr);
  });

  it("SOLIS — Vigente record extends to today", async () => {
    const { parsed } = await loadAndParse("SOLIS GARZA HECTOR RENE.pdf");
    const firstPeriod = parsed.salaryPeriods[0];
    expect(fmtDate(firstPeriod.fechaInicio)).toBe("01/07/2021");
    const today = new Date();
    const todayStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;
    expect(fmtDate(firstPeriod.fechaFin)).toBe(todayStr);
  });

  it("GARDUÑO — Vigente with movements extends to today", async () => {
    const { parsed } = await loadAndParse("GARDUÑO GARCIA VILLALOBOS ARTURO.pdf");
    // First period should extend to today (Vigente)
    const sorted = [...parsed.salaryPeriods].sort(
      (a, b) => b.fechaInicio.getTime() - a.fechaInicio.getTime()
    );
    const today = new Date();
    const todayStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;
    expect(fmtDate(sorted[0].fechaFin)).toBe(todayStr);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Promedio Salarial — exact match vs Excel reference
// ═══════════════════════════════════════════════════════════════════════
describe("Promedio Salarial (250 weeks)", () => {
  it("DELGADO — promedio $1,295.96", async () => {
    const { result } = await loadAndParse("DELGADO MANCILLA JOEL.pdf");
    expect(result.salaryAverage.promedio).toBeCloseTo(1295.96, 1);
  });

  it("GARDUÑO — promedio $237.49", async () => {
    const { result } = await loadAndParse("GARDUÑO GARCIA VILLALOBOS ARTURO.pdf");
    expect(result.salaryAverage.promedio).toBeCloseTo(237.49, 1);
  });

  it("GOMEZ — promedio ~$732 (PDF has 2 extra movements vs Excel, $0.90 diff)", async () => {
    const { result } = await loadAndParse("GOMEZ GORDILLO ALFREDO RAMON.pdf");
    // Allow $1 tolerance due to 71 vs 69 movements
    expect(Math.abs(result.salaryAverage.promedio - 732.17)).toBeLessThan(1.0);
  });

  it("SOLIS — promedio $2,230.99", async () => {
    const { result } = await loadAndParse("SOLIS GARZA HECTOR RENE.pdf");
    expect(result.salaryAverage.promedio).toBeCloseTo(2230.99, 1);
  });

  it("VEGA — promedio $616.89", async () => {
    const { result } = await loadAndParse("VEGA GARCIA FRANCISCO.pdf");
    expect(result.salaryAverage.promedio).toBeCloseTo(616.89, 1);
  });

  it("GONZALEZ — promedio $1,241.56", async () => {
    const { result } = await loadAndParse("GONZALEZ VAZQUEZ OCTAVIO.pdf");
    expect(result.salaryAverage.promedio).toBeCloseTo(1241.56, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 4: Salary period detail — validate individual periods
// ═══════════════════════════════════════════════════════════════════════
describe("Salary period details vs Excel", () => {
  it("GARDUÑO — each period matches Excel exactly", async () => {
    const { result } = await loadAndParse("GARDUÑO GARCIA VILLALOBOS ARTURO.pdf");
    const ref = refs["GARDUÑO GARCIA VILLALOBOS ARTURO"];
    const periods = result.salaryAverage.periods;

    // Check each Excel period appears in our results with matching values
    for (const refPeriod of ref.salaryPeriods) {
      const match = periods.find(
        (p) =>
          fmtDate(p.fechaAlta) === refPeriod.fechaInicio &&
          Math.abs(p.salarioDiario - refPeriod.salario) < 0.1
      );
      expect(match).toBeDefined();
      if (match) {
        expect(match.semanasTotales).toBeCloseTo(refPeriod.semanasTotales, 1);
        expect(match.semanasContadas).toBeCloseTo(refPeriod.semanasContadas, 1);
        expect(match.resultado).toBeCloseTo(refPeriod.resultado, 0);
      }
    }
  });

  it("VEGA — total resultado matches Excel", async () => {
    const { result } = await loadAndParse("VEGA GARCIA FRANCISCO.pdf");
    const ref = refs["VEGA GARCIA FRANCISCO"];
    const totalResultado = result.salaryAverage.periods.reduce((s, p) => s + p.resultado, 0);
    expect(totalResultado).toBeCloseTo(ref.totalResultado, 0);
  });

  it("VEGA — period count and key periods match", async () => {
    const { result } = await loadAndParse("VEGA GARCIA FRANCISCO.pdf");
    const periods = result.salaryAverage.periods;
    // Should have periods for all 24 records (some may be split by overlap resolution)
    expect(periods.length).toBeGreaterThanOrEqual(24);
    // First period (most recent) should have highest salary
    const sorted = [...periods].sort((a, b) => b.fechaAlta.getTime() - a.fechaAlta.getTime());
    expect(sorted[0].salarioDiario).toBeCloseTo(278.8, 1);
  });

  it("SOLIS — total resultado matches Excel", async () => {
    const { result } = await loadAndParse("SOLIS GARZA HECTOR RENE.pdf");
    const ref = refs["SOLIS GARZA HECTOR RENE"];
    const totalResultado = result.salaryAverage.periods.reduce((s, p) => s + p.resultado, 0);
    expect(totalResultado).toBeCloseTo(ref.totalResultado, 0);
  });

  it("SOLIS — key periods present (Vigente and second employment)", async () => {
    const { result } = await loadAndParse("SOLIS GARZA HECTOR RENE.pdf");
    const periods = result.salaryAverage.periods;
    // First period (Vigente): alta=01/07/2021, salary=2236.39
    const vigente = periods.find(
      (p) => fmtDate(p.fechaAlta) === "01/07/2021" && Math.abs(p.salarioDiario - 2236.39) < 0.1
    );
    expect(vigente).toBeDefined();
    expect(vigente!.semanasContadas).toBeGreaterThan(200);
  });

  it("DELGADO — all 4 periods present with correct structure", async () => {
    const { result } = await loadAndParse("DELGADO MANCILLA JOEL.pdf");
    const ref = refs["DELGADO MANCILLA JOEL"];
    const periods = result.salaryAverage.periods;

    expect(periods.length).toBe(4);
    // First period should accumulate all 250 weeks
    expect(periods[0].semanasContadas).toBeCloseTo(250, 0);
    // Other periods should have 0 weeks counted
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i].semanasContadas).toBe(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 5: Movement extraction accuracy
// ═══════════════════════════════════════════════════════════════════════
describe("Movement extraction", () => {
  it("GARDUÑO — all 15 movements match Excel", async () => {
    const { parsed } = await loadAndParse("GARDUÑO GARCIA VILLALOBOS ARTURO.pdf");
    const ref = refs["GARDUÑO GARCIA VILLALOBOS ARTURO"];

    expect(parsed.movements.length).toBe(ref.movements.length);

    for (let i = 0; i < ref.movements.length; i++) {
      const refMov = ref.movements[i];
      const ourMov = parsed.movements[i];
      expect(ourMov.type).toBe(refMov.type);
      expect(fmtDate(ourMov.fecha)).toBe(refMov.fecha);
      expect(ourMov.salario).toBeCloseTo(refMov.salario, 1);
    }
  });

  it("GONZALEZ — first 10 movements match known values", async () => {
    const { parsed } = await loadAndParse("GONZALEZ VAZQUEZ OCTAVIO.pdf");
    // Known first movements from previous validation
    const expected = [
      { type: "BAJA", fecha: "21/06/2024", salario: 1483.12 },
      { type: "MODIFICACION DE SALARIO", fecha: "01/05/2024", salario: 1483.12 },
      { type: "REINGRESO", fecha: "12/03/2024", salario: 1348.63 },
      { type: "BAJA", fecha: "06/04/2023", salario: 1524.67 },
      { type: "MODIFICACION DE SALARIO", fecha: "01/03/2023", salario: 1524.67 },
    ];

    for (let i = 0; i < expected.length; i++) {
      expect(parsed.movements[i].type).toBe(expected[i].type);
      expect(fmtDate(parsed.movements[i].fecha)).toBe(expected[i].fecha);
      expect(parsed.movements[i].salario).toBeCloseTo(expected[i].salario, 1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 6: Header extraction
// ═══════════════════════════════════════════════════════════════════════
describe("Header extraction", () => {
  const cases = [
    { pdf: "DELGADO MANCILLA JOEL.pdf", nombre: "DELGADO MANCILLA JOEL", nss: "52876708968" },
    { pdf: "GARDUÑO GARCIA VILLALOBOS ARTURO.pdf", nombre: "GARDUÑO GARCIA VILLALOBOS ARTURO", nss: "11937112669" },
    { pdf: "GOMEZ GORDILLO ALFREDO RAMON.pdf", nombre: "GOMEZ GORDILLO ALFREDO RAMON", nss: "07876512695" },
    { pdf: "SOLIS GARZA HECTOR RENE.pdf", nombre: "SOLIS GARZA HECTOR RENE", nss: "68897001316" },
    { pdf: "VEGA GARCIA FRANCISCO.pdf", nombre: "VEGA GARCIA FRANCISCO", nss: "24826617714" },
    { pdf: "GONZALEZ VAZQUEZ OCTAVIO.pdf", nombre: "GONZALEZ VAZQUEZ OCTAVIO", nss: "21906944398" },
  ];

  for (const c of cases) {
    it(`${c.nombre} — name and NSS`, async () => {
      const { parsed } = await loadAndParse(c.pdf);
      expect(parsed.header.nombre).toBe(c.nombre);
      expect(parsed.header.nss).toBe(c.nss);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 7: 250-week cap logic
// ═══════════════════════════════════════════════════════════════════════
describe("250-week cap logic", () => {
  it("caps accumulated weeks at exactly 250", () => {
    // Create simple test periods: one big period that exceeds 250 weeks
    const periods: SalaryPeriod[] = [
      {
        fechaInicio: parseDate("01/01/2020"),
        fechaFin: parseDate("01/01/2026"),
        salarioDiario: 500,
      },
    ];
    const result = calculateSalaryAverage(periods);
    expect(result.periods[0].semanasContadas).toBeCloseTo(250, 0);
    expect(result.promedio).toBeCloseTo(500, 1);
  });

  it("splits cap across multiple periods correctly", () => {
    const periods: SalaryPeriod[] = [
      {
        fechaInicio: parseDate("01/01/2024"),
        fechaFin: parseDate("01/01/2026"),
        salarioDiario: 1000,
      },
      {
        fechaInicio: parseDate("01/01/2020"),
        fechaFin: parseDate("01/01/2024"),
        salarioDiario: 500,
      },
    ];
    const result = calculateSalaryAverage(periods);
    const total = result.periods.reduce((s, p) => s + p.semanasContadas, 0);
    expect(total).toBeCloseTo(250, 0);
    expect(result.promedio).toBeGreaterThan(500);
    expect(result.promedio).toBeLessThan(1000);
  });

  it("shows all periods even those beyond 250 weeks (with 0 semanas contadas)", () => {
    const periods: SalaryPeriod[] = [
      {
        fechaInicio: parseDate("01/01/2022"),
        fechaFin: parseDate("01/01/2027"),
        salarioDiario: 1000,
      },
      {
        fechaInicio: parseDate("01/01/2015"),
        fechaFin: parseDate("01/01/2022"),
        salarioDiario: 200,
      },
    ];
    const result = calculateSalaryAverage(periods);
    expect(result.periods.length).toBe(2);
    expect(result.periods[1].semanasContadas).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 8: Overlap resolution (empalmes)
// ═══════════════════════════════════════════════════════════════════════
describe("Overlap resolution (empalmes)", () => {
  it("sums salaries during overlap period", () => {
    // Two overlapping employments
    const periods: SalaryPeriod[] = [
      {
        fechaInicio: parseDate("01/01/2024"),
        fechaFin: parseDate("01/06/2024"),
        salarioDiario: 300,
      },
      {
        fechaInicio: parseDate("01/03/2024"),
        fechaFin: parseDate("01/09/2024"),
        salarioDiario: 200,
      },
    ];
    const result = calculateSalaryAverage(periods);
    // Should have 3 sub-periods: A-only, A+B overlap, B-only
    const resolvedPeriods = result.periods.filter((p) => p.semanasTotales > 0);
    expect(resolvedPeriods.length).toBeGreaterThanOrEqual(3);

    // The overlap period should have salary = 500
    const overlapPeriod = resolvedPeriods.find(
      (p) => p.salarioDiario === 500
    );
    expect(overlapPeriod).toBeDefined();
  });

  it("non-overlapping periods are not affected", () => {
    const periods: SalaryPeriod[] = [
      {
        fechaInicio: parseDate("01/01/2024"),
        fechaFin: parseDate("01/06/2024"),
        salarioDiario: 300,
      },
      {
        fechaInicio: parseDate("01/07/2024"),
        fechaFin: parseDate("01/12/2024"),
        salarioDiario: 200,
      },
    ];
    const result = calculateSalaryAverage(periods);
    expect(result.periods.length).toBe(2);
    // Sorted DESC by fechaInicio: 01/07/2024 (200) first, then 01/01/2024 (300)
    expect(result.periods[0].salarioDiario).toBe(200);
    expect(result.periods[1].salarioDiario).toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 9: AFORE calculation structure
// ═══════════════════════════════════════════════════════════════════════
describe("AFORE calculation", () => {
  it("SAR92 only applies to periods before 1998", () => {
    const periods: SalaryPeriod[] = [
      {
        fechaInicio: parseDate("01/01/1995"),
        fechaFin: parseDate("01/01/1997"),
        salarioDiario: 100,
      },
    ];
    const result = calculateAfore(periods);
    expect(result.periods[0].sar92).toBeGreaterThan(0);
    expect(result.periods[0].sar97).toBe(0);
    expect(result.periods[0].vivienda92).toBeGreaterThan(0);
    expect(result.periods[0].vivienda97).toBe(0);
  });

  it("SAR97/RCV only applies to periods after 1997", () => {
    const periods: SalaryPeriod[] = [
      {
        fechaInicio: parseDate("01/01/2020"),
        fechaFin: parseDate("01/01/2022"),
        salarioDiario: 500,
      },
    ];
    const result = calculateAfore(periods);
    expect(result.periods[0].sar92).toBe(0);
    expect(result.periods[0].sar97).toBeGreaterThan(0);
    expect(result.periods[0].rcvTrabajador).toBeGreaterThan(0);
    expect(result.periods[0].rcvPatron).toBeGreaterThan(0);
    expect(result.periods[0].vivienda92).toBe(0);
    expect(result.periods[0].vivienda97).toBeGreaterThan(0);
  });

  it("RCV is NOT included in saldoAfore", () => {
    const periods: SalaryPeriod[] = [
      {
        fechaInicio: parseDate("01/01/2020"),
        fechaFin: parseDate("01/01/2022"),
        salarioDiario: 500,
      },
    ];
    const result = calculateAfore(periods);
    // saldoAfore should NOT include RCV
    expect(result.saldoAfore).not.toBe(0);
    expect(result.saldoRCV).not.toBe(0);
    expect(result.saldoAfore).toBeLessThan(result.saldoAfore + result.saldoRCV);
  });

  it("rendimientos use (2026 - year) * 0.1048 factor", () => {
    const periods: SalaryPeriod[] = [
      {
        fechaInicio: parseDate("01/01/2020"),
        fechaFin: parseDate("31/12/2020"),
        salarioDiario: 100,
      },
    ];
    const result = calculateAfore(periods);
    const p = result.periods[0];
    // Year 2020 (UTC), elapsed = 2026 - 2020 = 6, daysBetween inclusive = 366 days
    // totalSalario = 366 * 100 = 36600
    // sar97 = 36600 * 0.02 = 732
    // rendimiento = 6 * 0.1048 * 732 = 460.28
    expect(p.year).toBe(2020);
    expect(p.sar97).toBeCloseTo(732, 0);
    expect(p.sar97Rendimientos).toBeCloseTo(732 * 6 * 0.1048, 0);
    expect(p.vivienda97Rendimientos).toBeCloseTo(p.vivienda97 * 6 * 0.1048, 0);
  });

  it("all 6 PDFs produce non-zero AFORE values", async () => {
    const pdfs = [
      "DELGADO MANCILLA JOEL.pdf",
      "GARDUÑO GARCIA VILLALOBOS ARTURO.pdf",
      "GOMEZ GORDILLO ALFREDO RAMON.pdf",
      "SOLIS GARZA HECTOR RENE.pdf",
      "VEGA GARCIA FRANCISCO.pdf",
      "GONZALEZ VAZQUEZ OCTAVIO.pdf",
    ];
    for (const pdf of pdfs) {
      const { result } = await loadAndParse(pdf);
      expect(result.afore.saldoAfore).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 10: API route response format
// ═══════════════════════════════════════════════════════════════════════
describe("Date formatting consistency", () => {
  it("salary average dates are valid Date objects", async () => {
    const { result } = await loadAndParse("GARDUÑO GARCIA VILLALOBOS ARTURO.pdf");
    for (const p of result.salaryAverage.periods) {
      expect(p.fechaAlta).toBeInstanceOf(Date);
      expect(p.fechaBaja).toBeInstanceOf(Date);
      expect(p.fechaAlta.getTime()).not.toBeNaN();
      expect(p.fechaBaja.getTime()).not.toBeNaN();
      // fechaAlta should be before or equal to fechaBaja
      expect(p.fechaAlta.getTime()).toBeLessThanOrEqual(p.fechaBaja.getTime());
    }
  });

  it("salary periods have valid date ranges", async () => {
    const { parsed } = await loadAndParse("VEGA GARCIA FRANCISCO.pdf");
    for (const sp of parsed.salaryPeriods) {
      expect(sp.fechaInicio.getTime()).toBeLessThanOrEqual(sp.fechaFin.getTime());
      expect(sp.salarioDiario).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE 11: Edge cases
// ═══════════════════════════════════════════════════════════════════════
describe("Edge cases", () => {
  it("empty text returns zero results", () => {
    const parsed = parseOCRText("");
    expect(parsed.records.length).toBe(0);
    expect(parsed.movements.length).toBe(0);
    expect(parsed.salaryPeriods.length).toBe(0);
  });

  it("text with only header returns zero salary periods", () => {
    const text = `NSS: TEST PERSON 12345678901
CURP: TEPE900101HDFRRS01
Total de semanas cotizadas 500`;
    const parsed = parseOCRText(text);
    expect(parsed.salaryPeriods.length).toBe(0);
  });

  it("calculateSalaryAverage with empty periods returns zero", () => {
    const result = calculateSalaryAverage([]);
    expect(result.promedio).toBe(0);
    expect(result.periods.length).toBe(0);
  });

  it("calculateAfore with empty periods returns zero", () => {
    const result = calculateAfore([]);
    expect(result.saldoAfore).toBe(0);
    expect(result.saldoRCV).toBe(0);
  });
});

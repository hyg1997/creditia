// Extract COMPLETE reference data from all Excel files
import pkg from "xlsx";
const { readFile, utils } = pkg;
import path from "path";
import fs from "fs";

const DOCS_DIR = path.join(process.cwd(), "docs");

function excelDate(serial) {
  if (!serial || typeof serial !== "number" || serial < 1) return null;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(epoch.getTime() + serial * 24 * 60 * 60 * 1000);
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

const files = [
  { key: "DELGADO", xlsx: "DELGADO MANCILLA JOEL.xlsx", pdf: "DELGADO MANCILLA JOEL.pdf" },
  { key: "GARDUNO", xlsx: "GARDUÑO GARCIA VILLALOBOS ARTURO.xlsx", pdf: "GARDUÑO GARCIA VILLALOBOS ARTURO.pdf" },
  { key: "GOMEZ", xlsx: "GOMEZ GORDILLO ALFREDO RAMON.xlsx", pdf: "GOMEZ GORDILLO ALFREDO RAMON.pdf" },
  { key: "SOLIS", xlsx: "SOLIS GARZA HECTOR RENE.xlsx", pdf: "SOLIS GARZA HECTOR RENE.pdf" },
  { key: "VEGA", xlsx: "VEGA GARCIA FRANCISCO.xlsx", pdf: "VEGA GARCIA FRANCISCO.pdf" },
];

const result = {};

for (const f of files) {
  const wb = readFile(path.join(DOCS_DIR, f.xlsx));
  const ws = wb.Sheets["Promedio salarial"];
  const json = utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  // Raw movements (Col A-D, index 0-3, starting at row index 2)
  const movements = [];
  for (let i = 2; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;
    const tipo = row[0];
    const fecha = row[1];
    const salario = row[2];
    const fechaFin = row[3];
    if (!tipo || typeof tipo !== "string" || typeof fecha !== "number" || fecha < 1) continue;
    movements.push({
      type: tipo.toUpperCase().trim(),
      fecha: excelDate(fecha),
      salario: typeof salario === "number" ? +salario.toFixed(2) : 0,
      fechaFin: excelDate(fechaFin),
    });
  }

  // Processed ALTAs (Col F-I, index 5-8) — these are the periods the Excel actually uses
  const processedAltas = [];
  for (let i = 2; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;
    const tipo = row[5];
    const fecha = row[6];
    const salario = row[7];
    const fechaFin = row[8];
    if (!tipo || typeof fecha !== "number" || fecha < 1) continue;
    processedAltas.push({
      type: String(tipo).toUpperCase().trim(),
      fechaInicio: excelDate(fecha),
      salario: typeof salario === "number" ? +salario.toFixed(2) : 0,
      fechaFin: excelDate(fechaFin),
    });
  }

  // Salary Table (Col K-P, index 10-15, starting at row index 6)
  const salaryTable = [];
  for (let i = 6; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;
    const fi = row[10];
    const ff = row[11];
    const sal = row[12];
    const st = row[13];
    const sc = row[14];
    const res = row[15];
    if (!fi || typeof fi !== "number" || fi < 1) continue;
    // Skip rows where everything is 0
    if (typeof st === "number" && st === 0 && typeof sc === "number" && sc === 0 && typeof res === "number" && res === 0) continue;
    salaryTable.push({
      fechaInicio: excelDate(fi),
      fechaFin: excelDate(ff),
      salario: typeof sal === "number" ? +sal.toFixed(2) : 0,
      semanasTotales: typeof st === "number" ? +st.toFixed(4) : 0,
      semanasContadas: typeof sc === "number" ? +sc.toFixed(4) : 0,
      resultado: typeof res === "number" ? +res.toFixed(2) : 0,
    });
  }

  // Summary values
  const totalSemanas = json[3]?.[15]; // Row 4 col P
  const semanasPromediar = json[4]?.[15]; // Row 5 col P = 250
  const promedioDiario = json[5]?.[15]; // Row 6 col P
  const promedioMensual = json[5]?.[16]; // Row 6 col Q

  const totalResultado = salaryTable.reduce((s, p) => s + p.resultado, 0);

  result[f.key] = {
    pdf: f.pdf,
    movements,
    processedAltas,
    salaryTable,
    summary: {
      totalSemanas: typeof totalSemanas === "number" ? +totalSemanas.toFixed(4) : null,
      semanasPromediar: typeof semanasPromediar === "number" ? semanasPromediar : null,
      promedioDiario: typeof promedioDiario === "number" ? +promedioDiario.toFixed(2) : null,
      promedioMensual: typeof promedioMensual === "number" ? +promedioMensual.toFixed(2) : null,
      totalResultado: +totalResultado.toFixed(2),
      promedioCalc: +(totalResultado / 250).toFixed(2),
    },
  };
}

fs.writeFileSync(
  path.join(process.cwd(), "src/lib/__tests__/full-references.json"),
  JSON.stringify(result, null, 2)
);
console.log("Written to src/lib/__tests__/full-references.json");
console.log("\nSummary:");
for (const [key, data] of Object.entries(result)) {
  console.log(`  ${key}: ${data.movements.length} movs, ${data.processedAltas.length} altas, ${data.salaryTable.length} periods, promedio=$${data.summary.promedioCalc}`);
}

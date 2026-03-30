// Dump ALL non-empty data from each Excel for full comparison
import pkg from "xlsx";
const { readFile, utils } = pkg;
import path from "path";

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
  "DELGADO MANCILLA JOEL.xlsx",
  "GARDUÑO GARCIA VILLALOBOS ARTURO.xlsx",
  "GOMEZ GORDILLO ALFREDO RAMON.xlsx",
  "SOLIS GARZA HECTOR RENE.xlsx",
  "VEGA GARCIA FRANCISCO.xlsx",
];

for (const file of files) {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`  ${file}`);
  console.log("═".repeat(80));

  const wb = readFile(path.join(DOCS_DIR, file));
  const ws = wb.Sheets["Promedio salarial"];
  const json = utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  // Show ALL column headers (row 2 = index 1, row 3 = index 2, row 6 = index 5)
  console.log("\n  Row 2 (index 1) - Main headers:");
  if (json[1]) {
    for (let c = 0; c < json[1].length; c++) {
      if (json[1][c]) console.log(`    Col ${c} (${String.fromCharCode(65 + (c < 26 ? c : -1))}${c >= 26 ? String.fromCharCode(65 + c - 26) : ""}): ${json[1][c]}`);
    }
  }

  console.log("\n  Row 3 (index 2) - Sub headers:");
  if (json[2]) {
    for (let c = 0; c < json[2].length; c++) {
      if (json[2][c]) console.log(`    Col ${c}: ${json[2][c]}`);
    }
  }

  // Row 6 (index 5) - table headers
  console.log("\n  Row 6 (index 5) - Table sub-headers:");
  if (json[5]) {
    for (let c = 0; c < json[5].length; c++) {
      if (json[5][c]) console.log(`    Col ${c}: ${json[5][c]}`);
    }
  }

  // Show rows 4-6 (indices 3-5) — summary values
  console.log("\n  Summary rows:");
  for (let r = 3; r <= 5; r++) {
    if (!json[r]) continue;
    const vals = [];
    for (let c = 0; c < json[r].length; c++) {
      if (json[r][c] !== null && json[r][c] !== "" && json[r][c] !== 0) {
        let val = json[r][c];
        if (typeof val === "number" && val > 30000 && val < 60000) val = `${val} (=${excelDate(val)})`;
        vals.push(`Col${c}=${JSON.stringify(val)}`);
      }
    }
    if (vals.length) console.log(`  [${r}]: ${vals.join("  |  ")}`);
  }

  // Show columns A-D (movements) — all non-empty
  console.log("\n  Movements (Col A-D):");
  for (let r = 2; r < json.length; r++) {
    if (!json[r]) continue;
    const tipo = json[r][0];
    const fecha = json[r][1];
    const salario = json[r][2];
    const fechaFin = json[r][3];
    if (!tipo || typeof fecha !== "number") continue;
    console.log(`    ${String(tipo).padEnd(30)} ${excelDate(fecha)?.padEnd(12) || "N/A"}  $${typeof salario === "number" ? salario.toFixed(2) : "N/A"}  → ${excelDate(fechaFin) || "Vigente"}`);
  }

  // Show columns F-I (processed ALTAs)
  console.log("\n  Processed ALTAs (Col F-I):");
  for (let r = 2; r < json.length; r++) {
    if (!json[r]) continue;
    const tipo = json[r][5];
    const fecha = json[r][6];
    const salario = json[r][7];
    const fechaFin = json[r][8];
    if (!tipo || typeof fecha !== "number") continue;
    console.log(`    ${String(tipo).padEnd(10)} ${excelDate(fecha)?.padEnd(12) || "N/A"}  $${typeof salario === "number" ? salario.toFixed(2) : "N/A"}  → ${excelDate(fechaFin) || "N/A"}`);
  }

  // Show columns K-P (salary table)
  console.log("\n  Salary Table (Col K-P):");
  console.log("    Fecha Inicio    Fecha Fin       Salario     Sem.Totales  Sem.Contadas  Resultado");
  for (let r = 6; r < json.length; r++) {
    if (!json[r]) continue;
    const fi = json[r][10];
    const ff = json[r][11];
    const sal = json[r][12];
    const st = json[r][13];
    const sc = json[r][14];
    const res = json[r][15];
    if (!fi || typeof fi !== "number" || fi < 1) continue;
    if (typeof st === "number" && st === 0 && typeof sc === "number" && sc === 0 && typeof res === "number" && res === 0) continue;
    console.log(`    ${(excelDate(fi) || "").padEnd(16)} ${(excelDate(ff) || "").padEnd(16)} $${typeof sal === "number" ? sal.toFixed(2).padStart(10) : "N/A"}  ${typeof st === "number" ? st.toFixed(4).padStart(12) : "N/A"}  ${typeof sc === "number" ? sc.toFixed(4).padStart(12) : "N/A"}  $${typeof res === "number" ? res.toFixed(2).padStart(12) : "N/A"}`);
  }

  // Show columns R onwards (if any) — might have AFORE or another table
  console.log("\n  Extra columns (Col R+):");
  let hasExtra = false;
  for (let r = 5; r < Math.min(json.length, 15); r++) {
    if (!json[r]) continue;
    const vals = [];
    for (let c = 17; c < json[r].length; c++) {
      if (json[r][c] !== null && json[r][c] !== "" && json[r][c] !== 0) {
        let val = json[r][c];
        if (typeof val === "number" && val > 30000 && val < 60000) val = `${val}(=${excelDate(val)})`;
        vals.push(`C${c}=${JSON.stringify(val)}`);
      }
    }
    if (vals.length) { console.log(`  [${r}]: ${vals.join("  |  ")}`); hasExtra = true; }
  }
  if (!hasExtra) console.log("    (none)");

  // Check other sheets for AFORE data
  for (const sn of wb.SheetNames) {
    if (sn === "Promedio salarial") continue;
    const ws2 = wb.Sheets[sn];
    const range = ws2["!ref"];
    if (!range) continue;
    const json2 = utils.sheet_to_json(ws2, { header: 1, defval: null, raw: true });
    // Check if this sheet has non-empty data relevant to this person
    let hasData = false;
    for (let r = 2; r < Math.min(10, json2.length); r++) {
      if (json2[r] && json2[r][1] && typeof json2[r][1] === "number" && json2[r][1] > 30000) {
        hasData = true;
        break;
      }
    }
    if (hasData) console.log(`\n  ⚠️  Sheet "${sn}" also has data — might be for a different person`);
  }
}

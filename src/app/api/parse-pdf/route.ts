import { NextRequest, NextResponse } from "next/server";
import { parseOCRText } from "@/lib/pdf-parser";
import { calculateAll } from "@/lib/calculations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Se requiere el texto extraído del PDF" },
        { status: 400 }
      );
    }

    if (text.length < 100) {
      return NextResponse.json(
        { error: "El texto extraído es muy corto. Verifica que el PDF sea una Constancia de Semanas Cotizadas." },
        { status: 400 }
      );
    }

    // Parse the OCR text
    const parsed = parseOCRText(text);

    if (parsed.records.length === 0 && parsed.salaryPeriods.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron registros laborales en el PDF. Verifica que sea una Constancia de Semanas Cotizadas del IMSS." },
        { status: 400 }
      );
    }

    // Calculate everything
    const result = calculateAll(parsed);

    // Serialize dates for JSON response
    // Serialize dates as DD/MM/YYYY strings to avoid timezone issues
    const fmtDate = (d: Date) => {
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      return `${day}/${month}/${d.getFullYear()}`;
    };

    const serialized = {
      header: result.header,
      records: result.records.map((r) => ({
        ...r,
        fechaAlta: fmtDate(r.fechaAlta),
        fechaBaja: fmtDate(r.fechaBaja),
      })),
      salaryAverage: {
        promedio: result.salaryAverage.promedio,
        periods: result.salaryAverage.periods.map((p) => ({
          ...p,
          fechaAlta: fmtDate(p.fechaAlta),
          fechaBaja: fmtDate(p.fechaBaja),
        })),
      },
      afore: result.afore,
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Error processing PDF text:", error);
    return NextResponse.json(
      { error: "Error al procesar el texto del PDF" },
      { status: 500 }
    );
  }
}

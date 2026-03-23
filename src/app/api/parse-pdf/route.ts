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

    if (parsed.records.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron registros laborales en el PDF. Verifica que sea una Constancia de Semanas Cotizadas del IMSS." },
        { status: 400 }
      );
    }

    // Calculate everything
    const result = calculateAll(parsed);

    // Serialize dates for JSON response
    const serialized = {
      header: result.header,
      records: result.records.map((r) => ({
        ...r,
        fechaAlta: r.fechaAlta.toISOString(),
        fechaBaja: r.fechaBaja.toISOString(),
      })),
      salaryAverage: {
        promedio: result.salaryAverage.promedio,
        periods: result.salaryAverage.periods.map((p) => ({
          ...p,
          fechaAlta: p.fechaAlta.toISOString(),
          fechaBaja: p.fechaBaja.toISOString(),
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

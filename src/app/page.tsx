"use client";

import { useState, useCallback } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PdfUpload } from "@/components/pdf-upload";
import { ResultsSummary } from "@/components/results-summary";
import { AforeBreakdown } from "@/components/afore-breakdown";
import { EmploymentTimeline } from "@/components/employment-timeline";
import { SalaryAverageBreakdown } from "@/components/salary-average-breakdown";
import { PrintButton } from "@/components/print-button";

interface ApiResult {
  header: {
    nombre: string;
    nss: string;
    curp: string;
    totalSemanasCotizadas: number;
    semanasReconocidas: number;
    semanasDescontadas: number;
    semanasReintegradas: number;
  };
  records: {
    patron: string;
    registroPatronal: string;
    entidadFederativa: string;
    fechaAlta: string;
    fechaBaja: string;
    salarioBaseCotizacion: number;
  }[];
  salaryAverage: {
    promedio: number;
    periods: {
      fechaAlta: string;
      fechaBaja: string;
      salarioDiario: number;
      dias: number;
      semanasTotales: number;
      semanasContadas: number;
      resultado: number;
    }[];
  };
  afore: {
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
    saldoAfore: number;
    saldoRCV: number;
  };
}

export default function Home() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTextExtracted = useCallback(async (text: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Error al procesar el PDF");
        return;
      }

      setResult(data);
    } catch {
      setError("Error de conexion. Intenta de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return (
    <main className="flex-1">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Creditia</h1>
            <p className="text-sm text-muted-foreground">
              Calculadora AFORE desde PDF IMSS
            </p>
          </div>
          {result && (
            <div className="flex gap-2 no-print">
              <PrintButton />
              <Button variant="outline" onClick={handleReset}>
                Nuevo calculo
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Upload section */}
        {!result && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">
                Calcula tu Saldo AFORE
              </h2>
              <p className="text-muted-foreground">
                Sube tu Constancia de Semanas Cotizadas del IMSS y obtén tu
                saldo AFORE estimado al instante
              </p>
            </div>

            <PdfUpload
              onTextExtracted={handleTextExtracted}
              isProcessing={isProcessing}
            />

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p>
                Tu PDF se procesa localmente con OCR. No se almacena ningun dato.
              </p>
              <p>
                Acepta PDFs escaneados (CamScanner) y digitales del portal IMSS.
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-8">
            {/* Person info */}
            <div className="bg-card border rounded-lg p-4">
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nombre: </span>
                  <span className="font-semibold">{result.header.nombre}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">NSS: </span>
                  <span className="font-mono">{result.header.nss}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">CURP: </span>
                  <span className="font-mono">{result.header.curp}</span>
                </div>
              </div>
            </div>

            {/* Summary cards */}
            <ResultsSummary
              saldoAfore={result.afore.saldoAfore}
              saldoRCV={result.afore.saldoRCV}
              promedioSalarial={result.salaryAverage.promedio}
              totalSemanas={result.header.totalSemanasCotizadas}
              totalRecords={result.records.length || (result.afore.saldoAfore > 0 ? -1 : 0)}
            />

            <Separator />

            {/* AFORE breakdown */}
            <AforeBreakdown afore={result.afore} />

            <Separator />

            {/* Salary average breakdown */}
            <SalaryAverageBreakdown
              promedio={result.salaryAverage.promedio}
              periods={result.salaryAverage.periods}
            />

            {result.records.length > 0 && (
              <>
                <Separator />
                {/* Employment timeline */}
                <EmploymentTimeline records={result.records} />
              </>
            )}

            {/* Disclaimers */}
            <div className="text-xs text-muted-foreground space-y-1 border-t pt-4">
              <p>
                * Los calculos son estimaciones basadas en las formulas
                estandar del IMSS. El saldo real puede variar por: retiros
                parciales por desempleo, retiro por matrimonio, uso de credito
                Infonavit, o comisiones de la AFORE.
              </p>
              <p>
                * Rendimientos calculados a tasa fija de 10.48% anual. La tasa
                real varia segun la AFORE y las condiciones del mercado.
              </p>
              <p>
                * Este es un calculo informativo. Consulta tu estado de cuenta
                AFORE para el saldo oficial.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

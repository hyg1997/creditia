"use client";

import { useState, useCallback } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PdfUpload } from "@/components/pdf-upload";
import { ResultsSummary } from "@/components/results-summary";
import { AforeBreakdown } from "@/components/afore-breakdown";
import { EmploymentTimeline } from "@/components/employment-timeline";
import { SalaryAverageBreakdown } from "@/components/salary-average-breakdown";
import { PrintButton } from "@/components/print-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatMXN } from "@/lib/formatters";

function parseDDMMYYYY(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function calcSinTrabajar(records: { fechaBaja: string }[]) {
  if (records.length === 0) return null;
  const fechas = records.map((r) => parseDDMMYYYY(r.fechaBaja).getTime());
  const ultimaBaja = new Date(Math.max(...fechas));
  const hoy = new Date();
  const diffMs = hoy.getTime() - ultimaBaja.getTime();
  const dias = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const anos = Math.floor(dias / 365);
  const meses = Math.floor((dias % 365) / 30);
  const diasRestantes = dias - anos * 365 - meses * 30;
  return { dias, anos, meses, diasRestantes, ultimaBaja };
}

const COSTO_DIARIO_SIN_TRABAJAR = 274;
const LIMITE_MOD10_DIAS = 4 * 365 + 11 * 30 + 22;
const LIMITE_MOD40_DIAS = 11 * 30 + 12;

function calcEdadFromCURP(
  curp: string,
): { edad: number; fechaNacimiento: Date } | null {
  if (!curp || curp.length < 10) return null;
  const yy = parseInt(curp.substring(4, 6), 10);
  const mm = parseInt(curp.substring(6, 8), 10) - 1;
  const dd = parseInt(curp.substring(8, 10), 10);
  const year = yy <= 30 ? 2000 + yy : 1900 + yy;
  const fechaNacimiento = new Date(Date.UTC(year, mm, dd));
  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - year;
  const cumpleEsteAno = new Date(Date.UTC(hoy.getUTCFullYear(), mm, dd));
  if (hoy < cumpleEsteAno) edad--;
  return { edad, fechaNacimiento };
}

function detectModalidad(registroPatronal: string): "mod10" | "mod40" | null {
  const suffix = registroPatronal.slice(-2);
  if (suffix === "10") return "mod10";
  if (suffix === "33" || suffix === "40") return "mod40";
  return null;
}

function getUltimoRegistro(
  records: {
    registroPatronal: string;
    fechaAlta: string;
    fechaBaja: string;
    salarioBaseCotizacion: number;
  }[],
) {
  if (records.length === 0) return null;
  return records.reduce((latest, r) => {
    return parseDDMMYYYY(r.fechaBaja).getTime() >
      parseDDMMYYYY(latest.fechaBaja).getTime()
      ? r
      : latest;
  });
}

function calcSemanasUltimos5Anos(
  records: { fechaAlta: string; fechaBaja: string }[],
  ultimaCotizacion: Date,
): number {
  const cincoAnosAntes = new Date(
    Date.UTC(
      ultimaCotizacion.getUTCFullYear() - 5,
      ultimaCotizacion.getUTCMonth(),
      ultimaCotizacion.getUTCDate(),
    ),
  );
  let totalDias = 0;
  for (const r of records) {
    const alta = parseDDMMYYYY(r.fechaAlta);
    const baja = parseDDMMYYYY(r.fechaBaja);
    const start =
      alta.getTime() < cincoAnosAntes.getTime() ? cincoAnosAntes : alta;
    const end =
      baja.getTime() > ultimaCotizacion.getTime() ? ultimaCotizacion : baja;
    if (start.getTime() <= end.getTime()) {
      totalDias +=
        Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
        1;
    }
  }
  return Math.floor(totalDias / 7);
}

interface SubcuentaTotal {
  aportaciones: number;
  rendimientos: number;
  total: number;
}

interface ApiResult {
  regimen: "ley73" | "ley97";
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
    sar92: SubcuentaTotal;
    vivienda92: SubcuentaTotal;
    retiro: SubcuentaTotal;
    ceavTrabajador: SubcuentaTotal;
    ceavPatron: SubcuentaTotal;
    cuotaSocial: SubcuentaTotal;
    vivienda97: SubcuentaTotal;
    totalRCV: number;
    totalSAR92: number;
    totalVivienda: number;
    saldoTotal: number;
  };
}

function StatusBadge({
  pass,
  labelPass = "Cumple",
  labelFail = "No cumple",
}: {
  pass: boolean;
  labelPass?: string;
  labelFail?: string;
}) {
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full ${
        pass ? "bg-wv-green/10 text-wv-green" : "bg-wv-red/10 text-wv-red"
      }`}
    >
      <svg
        className="w-2.5 h-2.5 sm:w-3 sm:h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pass ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </>
        )}
      </svg>
      {pass ? labelPass : labelFail}
    </span>
  );
}

function SubCheck({
  pass,
  label,
  value,
}: {
  pass: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`rounded-lg p-2 sm:p-2.5 border ${pass ? "bg-wv-green/5 border-wv-green/20" : "bg-wv-red/5 border-wv-red/20"}`}
    >
      <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p className="text-xs sm:text-sm font-semibold mt-0.5">
        {pass ? "Cumple" : "No cumple"} — {value}
      </p>
    </div>
  );
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
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const isLey73 = result?.regimen === "ley73";
  const semanasTotales = result
    ? result.header.totalSemanasCotizadas + result.header.semanasReintegradas
    : 0;
  const cumpleSemanas = semanasTotales >= 900;
  const saldoAfore = result
    ? result.afore.totalSAR92 +
      result.afore.retiro.total +
      result.afore.totalVivienda
    : 0;
  const sinTrabajar = result ? calcSinTrabajar(result.records) : null;
  const montoRequerido = sinTrabajar
    ? sinTrabajar.dias * COSTO_DIARIO_SIN_TRABAJAR
    : 0;
  const cumpleAfore = saldoAfore >= montoRequerido;
  const faltante = Math.max(0, montoRequerido - saldoAfore);

  const ultimoRegistro = result ? getUltimoRegistro(result.records) : null;
  const modalidad = ultimoRegistro
    ? detectModalidad(ultimoRegistro.registroPatronal)
    : null;
  const ultimaCotizacion = ultimoRegistro
    ? parseDDMMYYYY(ultimoRegistro.fechaBaja)
    : null;
  const diasSinCotizar = sinTrabajar ? sinTrabajar.dias : 0;

  const mod10CumpleTiempo = diasSinCotizar <= LIMITE_MOD10_DIAS;
  const semanasEn5Anos =
    result && ultimaCotizacion
      ? calcSemanasUltimos5Anos(result.records, ultimaCotizacion)
      : 0;
  const mod10CumpleSemanas = semanasEn5Anos >= 52;
  const mod10Cumple = mod10CumpleTiempo && mod10CumpleSemanas;

  const mod40Cumple = diasSinCotizar <= LIMITE_MOD40_DIAS;

  const edadInfo = result ? calcEdadFromCURP(result.header.curp) : null;
  const edad = edadInfo?.edad ?? 0;
  const mesesSinCotizar = sinTrabajar
    ? sinTrabajar.anos * 12 + sinTrabajar.meses
    : 0;

  const asesoriaAhoraCumpleEdad = edad >= 60;
  const asesoriaAhoraCumpleMeses = mesesSinCotizar > 12;
  const asesoriaAhoraCumple =
    asesoriaAhoraCumpleEdad && asesoriaAhoraCumpleMeses;

  const asesoriaFuturoCumpleEdad = edad >= 59;
  const asesoriaFuturoCumpleMeses = mesesSinCotizar > 5;
  const asesoriaFuturoCumple =
    asesoriaFuturoCumpleEdad && asesoriaFuturoCumpleMeses;

  const initials = result?.header.nombre
    ? result.header.nombre
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
    : "";

  return (
    <main className="flex-1">
      <header className="bg-wv-surface/80 backdrop-blur-lg border-b border-wv-border text-foreground sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="h-8 w-8 rounded-lg bg-wv-cyan/10 flex items-center justify-center text-wv-cyan">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight">
                Creditia
              </h1>
              <p className="text-[10px] sm:text-[11px] text-wv-label leading-tight">
                Calculadora AFORE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 no-print">
            <ThemeToggle />
            {result && (
              <>
                <span className="hidden sm:inline-flex">
                  {isLey73 && <PrintButton />}
                </span>
                <Button
                  variant="ghost"
                  onClick={handleReset}
                  className="text-xs sm:text-sm bg-foreground/5 border border-foreground/10 text-foreground hover:bg-foreground/10 px-2.5 sm:px-3"
                >
                  <span className="sm:hidden">Nuevo</span>
                  <span className="hidden sm:inline">Nuevo cálculo</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {!result && (
          <div className="max-w-xl mx-auto space-y-5 sm:space-y-6">
            <div className="text-center pt-8 sm:pt-12 pb-2">
              <div className="inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-wv-cyan/10 text-wv-cyan mb-4 sm:mb-5">
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M12 12v6" />
                  <path d="m15 15-3-3-3 3" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
                Calcula tu Saldo AFORE
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto text-xs sm:text-sm leading-relaxed">
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

            <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground pb-4">
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3 h-3 text-wv-green shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Procesamiento local — sin almacenamiento</span>
              </div>
              <span className="hidden sm:inline text-wv-border">|</span>
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3 h-3 text-wv-cyan shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>PDFs escaneados y digitales del IMSS</span>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
            {/* Person Info */}
            <div className="bg-wv-surface rounded-[16px] border border-wv-border shadow-sm dark:shadow-none px-4 sm:px-5 py-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="hidden sm:flex h-10 w-10 shrink-0 rounded-full bg-wv-cyan/10 items-center justify-center text-wv-cyan font-bold text-sm">
                  {initials}
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-x-6 gap-y-1.5 sm:gap-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground text-[10px] sm:text-xs uppercase sm:normal-case tracking-wider sm:tracking-normal">
                      Nombre{" "}
                    </span>
                    <span className="font-semibold">
                      {result.header.nombre}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] sm:text-xs uppercase sm:normal-case tracking-wider sm:tracking-normal">
                      NSS{" "}
                    </span>
                    <span className="font-mono text-xs sm:text-sm">
                      {result.header.nss}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] sm:text-xs uppercase sm:normal-case tracking-wider sm:tracking-normal">
                      CURP{" "}
                    </span>
                    <span className="font-mono text-xs sm:text-sm">
                      {result.header.curp}
                    </span>
                  </div>
                  {edadInfo && (
                    <div>
                      <span className="text-muted-foreground text-[10px] sm:text-xs uppercase sm:normal-case tracking-wider sm:tracking-normal">
                        Edad{" "}
                      </span>
                      <span className="font-semibold">
                        {edadInfo.edad} años
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Verdict Banner */}
            {(() => {
              const razones: string[] = [];
              if (!isLey73) razones.push("Régimen Ley 97");
              if (!cumpleSemanas) razones.push(`Faltan ${900 - semanasTotales} semanas`);
              if (!cumpleAfore) razones.push(`Faltante AFORE: ${formatMXN(faltante)}`);
              if (modalidad === "mod10" && !mod10Cumple) razones.push("No cumple Modalidad 10");
              if (modalidad === "mod40" && !mod40Cumple) razones.push("No cumple Modalidad 40");

              const cumpleModalidad = modalidad === "mod10" ? mod10Cumple : modalidad === "mod40" ? mod40Cumple : true;
              const pasaFiltros = isLey73 && cumpleSemanas && cumpleAfore && cumpleModalidad;
              const acreditaAhora = pasaFiltros && asesoriaAhoraCumple;
              const acreditaFuturo = pasaFiltros && asesoriaFuturoCumple;

              if (!isLey73) {
                return (
                  <div className="rounded-xl sm:rounded-[16px] border-2 border-wv-red/30 bg-gradient-to-r from-wv-red/10 to-wv-surface px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 h-10 w-10 rounded-full bg-wv-red/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-wv-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </div>
                      <div>
                        <p className="font-bold text-sm sm:text-lg text-wv-red">No aplica — Régimen Ley 97</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Solo se atienden clientes Ley 73 (alta antes del 1 julio 1997)</p>
                      </div>
                    </div>
                  </div>
                );
              }

              if (acreditaAhora) {
                return (
                  <div className="rounded-xl sm:rounded-[16px] border-2 border-wv-green/40 bg-gradient-to-r from-wv-green/10 to-wv-surface px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 h-10 w-10 rounded-full bg-wv-green/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-wv-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <div>
                        <p className="font-bold text-sm sm:text-lg text-wv-green">Acredita Financiamiento Ahora</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{edad} años, {semanasTotales} semanas, {mesesSinCotizar} meses sin cotizar</p>
                      </div>
                    </div>
                  </div>
                );
              }

              if (acreditaFuturo) {
                return (
                  <div className="rounded-xl sm:rounded-[16px] border-2 border-wv-cyan/40 bg-gradient-to-r from-wv-cyan/10 to-wv-surface px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 h-10 w-10 rounded-full bg-wv-cyan/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-wv-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      </div>
                      <div>
                        <p className="font-bold text-sm sm:text-lg text-wv-cyan">Acredita Financiamiento Futuro</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                          {edad} años, {semanasTotales} semanas
                          {!asesoriaAhoraCumple && (
                            <span> — No acredita Ahora: {!asesoriaAhoraCumpleEdad ? `necesita 60 años (tiene ${edad})` : `necesita +12 meses sin cotizar (tiene ${mesesSinCotizar})`}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="rounded-xl sm:rounded-[16px] border-2 border-wv-red/30 bg-gradient-to-r from-wv-red/10 to-wv-surface px-4 sm:px-6 py-3 sm:py-4">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 h-10 w-10 rounded-full bg-wv-red/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-wv-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </div>
                    <div>
                      <p className="font-bold text-sm sm:text-lg text-wv-red">No acredita financiamiento</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{razones.length > 0 ? razones.join(" · ") : `${edad} años, ${mesesSinCotizar} meses sin cotizar`}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Validations */}
            <section>
              <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                  Validaciones
                </h2>
              </div>

              <div className="space-y-2 sm:space-y-2.5">
                {/* Ley 73 + Semanas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                    <div
                      className={`border-l-4 ${isLey73 ? "border-l-wv-green" : "border-l-wv-red"} px-3.5 sm:px-5 py-2.5 sm:py-3`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm">
                            Régimen Ley 73
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 leading-tight">
                            {isLey73
                              ? "Antes del 1 de julio de 1997"
                              : "Después del 1 de julio de 1997"}
                          </p>
                        </div>
                        <StatusBadge pass={isLey73} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                    <div
                      className={`border-l-4 ${cumpleSemanas ? "border-l-wv-green" : "border-l-wv-red"} px-3.5 sm:px-5 py-2.5 sm:py-3`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm">
                            Semanas Cotizadas
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 leading-tight">
                            {semanasTotales} semanas. Mínimo: 900
                          </p>
                        </div>
                        <StatusBadge pass={cumpleSemanas} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Saldo AFORE */}
                <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                  <div
                    className={`border-l-4 ${cumpleAfore ? "border-l-wv-green" : "border-l-wv-red"} px-3.5 sm:px-4 py-2.5 sm:py-3 space-y-2 sm:space-y-2.5`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-xs sm:text-sm">
                          Saldo AFORE
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                          Mín. {formatMXN(100000)}/año sin trabajar (
                          {formatMXN(COSTO_DIARIO_SIN_TRABAJAR)}/día)
                        </p>
                      </div>
                      <StatusBadge pass={cumpleAfore} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                      <div className="bg-muted/60 rounded-lg p-2">
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Sin trabajar
                        </p>
                        <p className="text-xs sm:text-sm font-semibold mt-0.5">
                          {sinTrabajar && sinTrabajar.dias > 0 ? (
                            <>
                              {sinTrabajar.anos > 0 && `${sinTrabajar.anos}a `}
                              {sinTrabajar.meses > 0 &&
                                `${sinTrabajar.meses}m `}
                              {sinTrabajar.diasRestantes > 0 &&
                                `${sinTrabajar.diasRestantes}d`}
                              <span className="text-muted-foreground font-normal text-[10px] sm:text-xs">
                                {" "}
                                ({sinTrabajar.dias}d)
                              </span>
                            </>
                          ) : (
                            "Trabajando"
                          )}
                        </p>
                      </div>
                      <div className="bg-muted/60 rounded-lg p-2">
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Requerido
                        </p>
                        <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5">
                          {formatMXN(montoRequerido)}
                        </p>
                      </div>
                      <div className="bg-muted/60 rounded-lg p-2">
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Saldo actual
                        </p>
                        <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5">
                          {formatMXN(saldoAfore)}
                        </p>
                      </div>
                      {!cumpleAfore && (
                        <div className="bg-wv-red/10 rounded-lg p-2">
                          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            Faltante
                          </p>
                          <p className="text-xs sm:text-sm font-semibold font-mono mt-0.5 text-wv-red">
                            {formatMXN(faltante)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modalidad (filtro) */}
                {(modalidad === "mod10" || modalidad === "mod40") && (
                  <div className="grid grid-cols-1">
                    {modalidad === "mod10" && (
                      <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                        <div
                          className={`border-l-4 ${mod10Cumple ? "border-l-wv-green" : "border-l-wv-red"} px-3.5 sm:px-4 py-2.5 sm:py-3 space-y-2`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-xs sm:text-sm">
                                Modalidad 10
                              </p>
                              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                                RP: {ultimoRegistro?.registroPatronal}
                              </p>
                            </div>
                            <StatusBadge pass={mod10Cumple} />
                          </div>
                          <div className="space-y-1.5">
                            <SubCheck
                              pass={mod10CumpleTiempo}
                              label="Conservación (máx. 4a 11m 22d)"
                              value={`${diasSinCotizar} días`}
                            />
                            <SubCheck
                              pass={mod10CumpleSemanas}
                              label="Mín. 52 sem. en 5 años"
                              value={`${semanasEn5Anos} semanas`}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {modalidad === "mod40" && (
                      <div className="bg-wv-surface rounded-xl sm:rounded-[16px] border border-wv-border shadow-sm dark:shadow-none overflow-hidden">
                        <div
                          className={`border-l-4 ${mod40Cumple ? "border-l-wv-green" : "border-l-wv-red"} px-3.5 sm:px-4 py-2.5 sm:py-3 space-y-2`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-xs sm:text-sm">
                                Modalidad 40
                              </p>
                              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                                RP: {ultimoRegistro?.registroPatronal}
                              </p>
                            </div>
                            <StatusBadge pass={mod40Cumple} />
                          </div>
                          <SubCheck
                            pass={mod40Cumple}
                            label={`Máx. ${LIMITE_MOD40_DIAS} días sin cotizar`}
                            value={`${diasSinCotizar} días`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Financiamiento — decisión clave para el asesor */}
                {edadInfo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                    <div
                      className={`rounded-xl sm:rounded-[16px] overflow-hidden border-2 ${asesoriaAhoraCumple ? "border-wv-green/40 bg-gradient-to-br from-wv-surface to-wv-green/5" : "border-wv-red/30 bg-gradient-to-br from-wv-surface to-wv-red/5"}`}
                    >
                      <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm sm:text-base">
                              Financiamiento Ahora
                            </p>
                            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                              Pensión inmediata
                            </p>
                          </div>
                          <StatusBadge
                            pass={asesoriaAhoraCumple}
                            labelPass="Acredita"
                            labelFail="No acredita"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <SubCheck
                            pass={asesoriaAhoraCumpleEdad}
                            label="Edad min. 60"
                            value={`${edad} años`}
                          />
                          <SubCheck
                            pass={asesoriaAhoraCumpleMeses}
                            label="> 12 meses sin cotizar"
                            value={`${mesesSinCotizar} meses`}
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      className={`rounded-xl sm:rounded-[16px] overflow-hidden border-2 ${asesoriaFuturoCumple ? "border-wv-green/40 bg-gradient-to-br from-wv-surface to-wv-green/5" : "border-wv-red/30 bg-gradient-to-br from-wv-surface to-wv-red/5"}`}
                    >
                      <div className="px-4 sm:px-5 py-3 sm:py-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm sm:text-base">
                              Financiamiento Futuro
                            </p>
                            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                              Planeación a pensión
                            </p>
                          </div>
                          <StatusBadge
                            pass={asesoriaFuturoCumple}
                            labelPass="Acredita"
                            labelFail="No acredita"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <SubCheck
                            pass={asesoriaFuturoCumpleEdad}
                            label="Edad min. 59"
                            value={`${edad} años`}
                          />
                          <SubCheck
                            pass={asesoriaFuturoCumpleMeses}
                            label="> 5 meses sin cotizar"
                            value={`${mesesSinCotizar} meses`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {!isLey73 && (
              <div className="text-center py-2">
                <Button onClick={handleReset}>Subir otro PDF</Button>
              </div>
            )}

            {isLey73 && (
              <>
                <section>
                  <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                    <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                    <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                      Resumen Financiero
                    </h2>
                  </div>
                  <ResultsSummary
                    saldoAforeRegresar={saldoAfore}
                    saldoSAR={
                      result.afore.totalSAR92 + result.afore.retiro.total
                    }
                    saldoRCV={result.afore.totalRCV}
                    saldoVivienda={result.afore.totalVivienda}
                    promedioSalarial={result.salaryAverage.promedio}
                    totalSemanas={result.header.totalSemanasCotizadas}
                    totalRecords={
                      result.records.length || (saldoAfore > 0 ? -1 : 0)
                    }
                  />
                </section>

                <section>
                  <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                    <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                    <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                      Desglose de Cuentas
                    </h2>
                  </div>
                  <AforeBreakdown afore={result.afore} />
                </section>

                <section>
                  <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                    <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                    <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                      Promedio Salarial
                    </h2>
                  </div>
                  <SalaryAverageBreakdown
                    promedio={result.salaryAverage.promedio}
                    periods={result.salaryAverage.periods}
                  />
                </section>

                {result.records.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                      <div className="h-4 w-1 rounded-full bg-wv-cyan" />
                      <h2 className="text-xs sm:text-sm font-semibold tracking-tight uppercase sm:normal-case">
                        Historial Laboral
                      </h2>
                    </div>
                    <EmploymentTimeline records={result.records} />
                  </section>
                )}

                <footer className="text-[10px] sm:text-[11px] text-muted-foreground space-y-1 border-t border-wv-border pt-4 sm:pt-5 pb-4">
                  <p>
                    * Estimaciones basadas en fórmulas estándar del IMSS. El
                    saldo real puede variar por retiros, crédito Infonavit o
                    comisiones.
                  </p>
                  <p>
                    * Rendimientos: interés simple al 10.48% anual. La tasa real
                    varía según la AFORE.
                  </p>
                  <p>
                    * Cálculo informativo. Consulta tu estado de cuenta AFORE
                    para el saldo oficial.
                  </p>
                </footer>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

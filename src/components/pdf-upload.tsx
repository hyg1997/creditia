"use client";

import { useCallback, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PdfUploadProps {
  onTextExtracted: (text: string) => void;
  isProcessing: boolean;
}

const MAX_WORKERS = 4;

export function PdfUpload({ onTextExtracted, isProcessing }: PdfUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [ocrPercent, setOcrPercent] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        alert("Por favor selecciona un archivo PDF");
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        alert("El archivo es muy grande. Máximo 20MB.");
        return;
      }

      setOcrProgress("Cargando PDF...");
      setOcrPercent(5);

      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        setOcrProgress(`PDF cargado. ${numPages} páginas. Extrayendo texto...`);
        setOcrPercent(10);

        // ── Strategy 1: Try native text extraction (instant for digital PDFs) ──
        let fullText = "";
        let nativeTextLength = 0;

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item) => ("str" in item ? (item as { str: string }).str : ""))
            .join(" ");
          fullText += `\n--- PAGE ${i} ---\n` + pageText + "\n";
          nativeTextLength += pageText.replace(/\s/g, "").length;
        }

        // If native extraction got enough text, use it (no OCR needed)
        // Threshold: at least 50 non-whitespace chars per page on average
        if (nativeTextLength > numPages * 50) {
          setOcrProgress("Texto extraido directamente (PDF digital).");
          setOcrPercent(95);
          onTextExtracted(fullText);
          return;
        }

        // ── Strategy 2: OCR with parallel workers (for scanned PDFs) ──
        setOcrProgress("PDF escaneado detectado. Iniciando OCR...");
        setOcrPercent(15);

        const Tesseract = (await import("tesseract.js")).default;
        const workerCount = Math.min(MAX_WORKERS, numPages);

        // Create scheduler with multiple workers
        const scheduler = Tesseract.createScheduler();
        for (let w = 0; w < workerCount; w++) {
          const worker = await Tesseract.createWorker("spa");
          scheduler.addWorker(worker);
        }

        setOcrProgress(`OCR con ${workerCount} workers en paralelo...`);
        setOcrPercent(20);

        // Render all pages to canvas and queue OCR jobs in parallel
        let completedPages = 0;
        const pageTexts: string[] = new Array(numPages).fill("");

        const ocrPage = async (pageNum: number) => {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport }).promise;

          const { data: { text } } = await scheduler.addJob("recognize", canvas);

          // Clean up canvas memory
          canvas.width = 0;
          canvas.height = 0;

          pageTexts[pageNum - 1] = `\n--- PAGE ${pageNum} ---\n` + text;

          completedPages++;
          const pct = 20 + (completedPages / numPages) * 75;
          setOcrPercent(Math.round(pct));
          setOcrProgress(`OCR: ${completedPages}/${numPages} páginas...`);
        };

        // Launch all pages concurrently — scheduler distributes across workers
        await Promise.all(
          Array.from({ length: numPages }, (_, i) => ocrPage(i + 1))
        );

        await scheduler.terminate();

        fullText = pageTexts.join("\n");

        setOcrProgress("OCR completado. Calculando...");
        setOcrPercent(98);

        onTextExtracted(fullText);
      } catch (error) {
        console.error("Error processing PDF:", error);
        alert(
          "Error al procesar el PDF. Verifica que sea un archivo válido."
        );
      } finally {
        setOcrProgress(null);
        setOcrPercent(0);
      }
    },
    [onTextExtracted]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!isProcessing && !ocrProgress) setIsDragging(true);
    },
    [isProcessing, ocrProgress]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isProcessing || ocrProgress) return;
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [isProcessing, ocrProgress, processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  const isDisabled = isProcessing || !!ocrProgress;

  return (
    <Card
      className={`border-2 border-dashed transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : isDisabled
            ? "border-muted bg-muted/30"
            : "border-muted-foreground/25 hover:border-primary/50"
      }`}
    >
      <CardContent
        className="flex flex-col items-center justify-center py-12 px-6"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {ocrProgress ? (
          <div className="text-center space-y-4 w-full max-w-md">
            <div className="text-4xl">
              <svg
                className="animate-spin h-10 w-10 mx-auto text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium">{ocrProgress}</p>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${ocrPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              PDFs digitales: instantaneo. Escaneados: ~30s con OCR paralelo.
            </p>
          </div>
        ) : (
          <>
            <div className="text-5xl mb-4 opacity-60">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
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
            <h3 className="text-lg font-semibold mb-1">
              Sube tu Constancia de Semanas Cotizadas
            </h3>
            <p className="text-muted-foreground text-sm mb-4 text-center">
              Arrastra y suelta tu PDF aqui, o haz clic para seleccionar
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isDisabled}
              size="lg"
            >
              Seleccionar PDF
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            <p className="text-xs text-muted-foreground mt-3">
              PDF del IMSS - Maximo 20MB
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

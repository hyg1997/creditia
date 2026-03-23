"use client";

import { useCallback, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PdfUploadProps {
  onTextExtracted: (text: string) => void;
  isProcessing: boolean;
}

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
        // Dynamically import heavy libraries
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        setOcrProgress(`PDF cargado. ${numPages} páginas encontradas. Iniciando OCR...`);
        setOcrPercent(10);

        // Import tesseract.js
        const Tesseract = (await import("tesseract.js")).default;

        // Create a scheduler for parallel processing
        const worker = await Tesseract.createWorker("spa+eng", undefined, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              const pageProgress = m.progress * 100;
              setOcrPercent(Math.round(10 + pageProgress * 0.85));
            }
          },
        });

        let fullText = "";

        for (let i = 1; i <= numPages; i++) {
          setOcrProgress(`Procesando página ${i} de ${numPages}...`);

          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });

          // Render page to canvas
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;

          await page.render({ canvasContext: ctx, viewport }).promise;

          // OCR the canvas
          const {
            data: { text },
          } = await worker.recognize(canvas);
          fullText += text + "\n";

          const progressPct = 10 + ((i / numPages) * 85);
          setOcrPercent(Math.round(progressPct));
        }

        await worker.terminate();

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
              El OCR puede tardar 1-2 minutos dependiendo del PDF
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

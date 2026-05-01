"use client";

import { useCallback, useState, useRef } from "react";
import { Button } from "@/components/ui/button";

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

        if (nativeTextLength > numPages * 50) {
          setOcrProgress("Texto extraído directamente (PDF digital).");
          setOcrPercent(95);
          onTextExtracted(fullText);
          return;
        }

        setOcrProgress("PDF escaneado detectado. Iniciando OCR...");
        setOcrPercent(15);

        const Tesseract = (await import("tesseract.js")).default;
        const workerCount = Math.min(MAX_WORKERS, numPages);

        const scheduler = Tesseract.createScheduler();
        for (let w = 0; w < workerCount; w++) {
          const worker = await Tesseract.createWorker("spa");
          scheduler.addWorker(worker);
        }

        setOcrProgress(`OCR con ${workerCount} workers en paralelo...`);
        setOcrPercent(20);

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

          canvas.width = 0;
          canvas.height = 0;

          pageTexts[pageNum - 1] = `\n--- PAGE ${pageNum} ---\n` + text;

          completedPages++;
          const pct = 20 + (completedPages / numPages) * 75;
          setOcrPercent(Math.round(pct));
          setOcrProgress(`OCR: ${completedPages}/${numPages} páginas...`);
        };

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
    <div
      className={`relative rounded-[16px] border-2 border-dashed transition-all duration-200 ${
        isDragging
          ? "border-wv-cyan bg-wv-cyan/5 scale-[1.01]"
          : isDisabled
            ? "border-wv-border bg-muted/30"
            : "border-wv-border hover:border-wv-cyan/50 hover:bg-wv-cyan/5"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 sm:px-6">
        {ocrProgress ? (
          <div className="text-center space-y-3 sm:space-y-4 w-full max-w-md">
            <div className="inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-wv-cyan/10">
              <svg
                className="animate-spin h-5 w-5 sm:h-6 sm:w-6 text-wv-cyan"
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
            <p className="text-xs sm:text-sm font-medium">{ocrProgress}</p>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-wv-cyan h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${ocrPercent}%` }}
              />
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              PDFs digitales: instantáneo. Escaneados: ~30s con OCR paralelo.
            </p>
          </div>
        ) : (
          <>
            <div className="inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground mb-3 sm:mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
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
            <p className="text-xs sm:text-sm font-medium mb-1">
              Arrastra y suelta tu PDF aquí
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 sm:mb-4">
              o haz clic para seleccionar
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isDisabled}
              className="bg-wv-cyan hover:bg-wv-cyan/80 text-black font-semibold text-xs sm:text-sm h-9 sm:h-10 px-4 sm:px-6"
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
            <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-2.5 sm:mt-3">
              PDF del IMSS — Máximo 20MB
            </p>
          </>
        )}
      </div>
    </div>
  );
}

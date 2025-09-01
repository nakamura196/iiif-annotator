"use client";

import { useState, useCallback, useEffect } from "react";
import { NDLKotenOCR } from "ndl-koten-ocr-core";
import { Scan, X, Download, Copy, Check } from "lucide-react";
import { useTranslations } from "next-intl";

// Declare global ort
declare global {
  interface Window {
    ort: unknown;
  }
}

interface Detection {
  box: number[];  // [x, y, width, height]
  text: string;
  score?: number;
}

interface OCRProcessorProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  canvasWidth?: number;
  canvasHeight?: number;
  onTextExtracted?: (text: string, detections?: Detection[]) => void;
}

export function OCRProcessor({ isOpen, onClose, imageUrl, canvasWidth, canvasHeight, onTextExtracted }: OCRProcessorProps) {
  const t = useTranslations("OCRProcessor");
  const [ocr, setOcr] = useState<NDLKotenOCR | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [result, setResult] = useState<{ text?: string; json?: unknown; xml?: string; detections?: Detection[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"text" | "json" | "xml">("text");

  // Initialize OCR engine
  useEffect(() => {
    if (!isOpen) return;

    const initializeOCR = async () => {
      if (ocr) return; // Already initialized
      
      setIsInitializing(true);
      setError(null);
      
      try {
        const ocrInstance = new NDLKotenOCR();
        
        // Load models from public directory
        await ocrInstance.initialize(
          "/models/rtmdet-s-1280x1280.onnx",  // Layout detection model
          {}, // Default config
          "/models/ndl.yaml",  // Layout config
          "/models/parseq-ndl-32x384-tiny-10.onnx",  // Text recognition model
          {}, // Default config
          "/models/NDLmoji.yaml",  // Recognition config (fixed path)
          () => {
            // Progress callback if needed
          }
        );
        
        setOcr(ocrInstance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize OCR");
      } finally {
        setIsInitializing(false);
      }
    };

    initializeOCR();
  }, [isOpen, ocr]);

  // Process image
  const processImage = useCallback(async () => {
    if (!ocr || !imageUrl) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Load image from URL
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Process with OCR
      const ocrResult = await ocr.process(img, {
        imageName: "annotation-image"
      });

      // Calculate scaling factors if canvas dimensions are provided
      const scaleX = canvasWidth ? canvasWidth / img.naturalWidth : 1;
      const scaleY = canvasHeight ? canvasHeight / img.naturalHeight : 1;

      // Extract detections from result - check multiple possible structures
      const detections: Detection[] = [];
      
      // Check if json result exists and has the expected structure
      if (ocrResult.json && typeof ocrResult.json === 'object') {
        const jsonResult = ocrResult.json as Record<string, unknown>;
        
        // Check for different possible structures
        // Structure 1: detections array directly
        if ('detections' in jsonResult && Array.isArray(jsonResult.detections)) {
          for (const det of jsonResult.detections) {
            const detection = det as Record<string, unknown>;
            if (detection.box && detection.text) {
              const box = detection.box as number[];
              detections.push({
                box: [
                  box[0] * scaleX,
                  box[1] * scaleY,
                  box[2] * scaleX,
                  box[3] * scaleY
                ],
                text: detection.text as string,
                score: detection.score as number | undefined
              });
            }
          }
        }
        // Structure 2: document.image.text array (based on reference implementation)
        else if ('document' in jsonResult && 
                 jsonResult.document && 
                 typeof jsonResult.document === 'object' &&
                 'image' in jsonResult.document &&
                 (jsonResult.document as Record<string, unknown>).image &&
                 typeof (jsonResult.document as Record<string, unknown>).image === 'object' &&
                 'text' in ((jsonResult.document as Record<string, unknown>).image as Record<string, unknown>) &&
                 Array.isArray(((jsonResult.document as Record<string, unknown>).image as Record<string, unknown>).text)) {
          for (const textItem of ((jsonResult.document as Record<string, unknown>).image as Record<string, unknown>).text as unknown[]) {
            const item = textItem as Record<string, unknown>;
            if (item.x !== undefined && item.y !== undefined && 
                item.width !== undefined && item.height !== undefined && 
                item.text) {
              detections.push({
                box: [
                  (item.x as number) * scaleX,
                  (item.y as number) * scaleY,
                  (item.width as number) * scaleX,
                  (item.height as number) * scaleY
                ],
                text: item.text as string,
                score: item.confidence as number | undefined
              });
            }
          }
        }
      }
      
      const resultWithDetections = { ...ocrResult, detections };
      setResult(resultWithDetections);
      
      // Don't automatically send results - wait for user to click "Apply as Annotations"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image");
    } finally {
      setIsProcessing(false);
    }
  }, [ocr, imageUrl, canvasWidth, canvasHeight]);

  // Copy result to clipboard
  const handleCopy = async () => {
    if (!result) return;

    let textToCopy = "";
    switch (outputFormat) {
      case "text":
        textToCopy = result.text || "";
        break;
      case "json":
        textToCopy = JSON.stringify(result.json, null, 2);
        break;
      case "xml":
        textToCopy = result.xml || "";
        break;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard");
    }
  };

  // Download result
  const handleDownload = () => {
    if (!result) return;

    let content = "";
    let filename = "";
    let mimeType = "";

    switch (outputFormat) {
      case "text":
        content = result.text || "";
        filename = "ocr-result.txt";
        mimeType = "text/plain";
        break;
      case "json":
        content = JSON.stringify(result.json, null, 2);
        filename = "ocr-result.json";
        mimeType = "application/json";
        break;
      case "xml":
        content = result.xml || "";
        filename = "ocr-result.xml";
        mimeType = "application/xml";
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Scan className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t("title")}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as "text" | "json" | "xml")}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                    rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="text">{t("text")}</option>
                  <option value="json">{t("json")}</option>
                  <option value="xml">{t("xml")}</option>
                </select>
                <button
                  onClick={handleCopy}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 
                    dark:hover:text-gray-100 transition-colors"
                  title={t("copy")}
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 
                    dark:hover:text-gray-100 transition-colors"
                  title={t("download")}
                >
                  <Download className="h-5 w-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 
                dark:hover:text-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-auto max-h-[calc(90vh-140px)]">
          {isInitializing && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t("initializing")}</p>
            </div>
          )}

          {!isInitializing && !result && !isProcessing && (
            <div className="flex flex-col items-center justify-center py-12">
              <button
                onClick={processImage}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                  transition-colors flex items-center gap-2"
              >
                <Scan className="h-5 w-5" />
                {t("process")}
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t("processing")}</p>
            </div>
          )}

          {error && (
            <div className="text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded">
              {error}
            </div>
          )}

          {result && (
            <div>
              {outputFormat === "text" && (
                <pre className="text-sm text-gray-800 dark:text-gray-200 font-mono bg-gray-50 
                  dark:bg-gray-900 p-4 rounded overflow-x-auto whitespace-pre-wrap">
                  {result.text || t("noResult")}
                </pre>
              )}
              {outputFormat === "json" && (
                <pre className="text-sm text-gray-800 dark:text-gray-200 font-mono bg-gray-50 
                  dark:bg-gray-900 p-4 rounded overflow-x-auto">
                  <code>{JSON.stringify(result.json, null, 2)}</code>
                </pre>
              )}
              {outputFormat === "xml" && (
                <pre className="text-sm text-gray-800 dark:text-gray-200 font-mono bg-gray-50 
                  dark:bg-gray-900 p-4 rounded overflow-x-auto">
                  <code>{result.xml || t("noResult")}</code>
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {result && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {result.detections && result.detections.length > 0 ? `${result.detections.length} detections` : ""}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={processImage}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 
                    transition-colors text-sm"
                >
                  {t("process")}
                </button>
                {result.detections && result.detections.length > 0 && (
                  <button
                    onClick={() => {
                      if (onTextExtracted && result.text) {
                        onTextExtracted(result.text, result.detections);
                      }
                      onClose();
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 
                      transition-colors text-sm"
                  >
                    {t("applyAsAnnotations")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
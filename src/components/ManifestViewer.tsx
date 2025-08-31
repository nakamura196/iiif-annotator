"use client";

import { useState, useEffect } from "react";
import { X, Copy, Check, FileJson, Download } from "lucide-react";

interface ManifestViewerProps {
  manifestUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ManifestViewer({ manifestUrl, isOpen, onClose }: ManifestViewerProps) {
  const [manifest, setManifest] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !manifestUrl) return;

    const fetchManifest = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(manifestUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch manifest: ${response.status}`);
        }
        const data = await response.json();
        setManifest(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load manifest");
      } finally {
        setLoading(false);
      }
    };

    fetchManifest();
  }, [isOpen, manifestUrl]);

  const handleCopy = async () => {
    if (!manifest) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    if (!manifest) return;
    
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manifest.json";
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
            <FileJson className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              IIIF Manifest
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 
                dark:hover:text-gray-100 transition-colors"
              title="Copy to clipboard"
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
              title="Download JSON"
            >
              <Download className="h-5 w-5" />
            </button>
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
        <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          
          {error && (
            <div className="text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded">
              {error}
            </div>
          )}
          
          {manifest && (
            <pre className="text-sm text-gray-800 dark:text-gray-200 font-mono bg-gray-50 
              dark:bg-gray-900 p-4 rounded overflow-x-auto">
              <code>{JSON.stringify(manifest, null, 2)}</code>
            </pre>
          )}
        </div>

        {/* Footer with URL */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">URL:</span>
            <span className="truncate flex-1" title={manifestUrl}>
              {manifestUrl}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
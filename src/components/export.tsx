"use client";

import { useState, useRef, useEffect } from "react";
import FirestoreAnnotationAdapter from "@/lib/FirestoreAnnotationAdapter";
import { createTEI } from "@/lib/utils/export/tei/createTEI";
import { AnnotationWidthSingleBody } from "@/types/annotation";
import { createManifest } from "@/lib/utils/export/manifest/createManifest";
import { useTranslations } from 'next-intl';
import { ExternalLink, Download, Upload } from 'lucide-react';
import { buttonClass } from "@nakamura196/react-ui";

export const Export = ({
  adapter,
}: {
  adapter: FirestoreAnnotationAdapter | null;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('Editor');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const exportAnnotations = async (
    format: "json" | "csv" | "tei" | "manifest",
    openInBrowser: boolean = false
  ) => {
    if (!adapter) return;
    const annotations = await adapter.export();

    let content: string;
    let mimeType: string;
    let extension: string;
    let fileName: string;

    switch (format) {
      case "csv":
        content = (annotations.items as Array<{ id: string; body?: { value?: string }[] }>)
          .map((a) => `${a.id},${a.body?.[0]?.value || ""}`)
          .join("\n");
        mimeType = "text/csv";
        extension = "csv";
        fileName = "annotation-csv";
        break;
      case "tei":
        content = await createTEI(
          annotations.items as AnnotationWidthSingleBody[]
        );
        mimeType = "application/xml";
        extension = "xml";
        fileName = "annotation-tei";
        break;
      case "manifest":
        content = await createManifest(
          annotations.items as AnnotationWidthSingleBody[]
        );
        mimeType = "application/json";
        extension = "json";
        fileName = "annotation-manifest";
        break;
      default:
        content = JSON.stringify(annotations["items"], null, 2);
        mimeType = "application/json";
        extension = "json";
        fileName = "annotation-json";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    if (openInBrowser) {
      // Open in new tab
      window.open(url, '_blank');
      // Clean up after a delay to ensure the tab has loaded
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      // Download file
      const a = document.createElement("a");
      a.href = url;
      const now = new Date().toISOString().replace(/[-:Z]/g, "");
      a.download = `${fileName}-${now}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    }

    setIsOpen(false);
  };

  const sectionLabel =
    "px-4 py-2 text-xs font-semibold text-[var(--ds-fg-muted)] uppercase tracking-wider";
  const menuItem =
    "w-full text-left px-4 py-2 text-sm text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)] cursor-pointer flex items-center gap-2 transition-colors";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClass("primary", "sm", "gap-2")}
      >
        <Upload className="h-4 w-4" />
        {t('exportButton')}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 bottom-full mb-2 w-64 rounded-md shadow-lg
          bg-[var(--ds-bg)] border border-[var(--ds-border)] z-50"
        >
          <div className="py-1" role="menu">
            {/* IIIF Manifest */}
            <div className={sectionLabel}>IIIF Manifest</div>
            <button
              onClick={() => exportAnnotations("manifest", true)}
              className={menuItem}
              role="menuitem"
            >
              <ExternalLink className="h-4 w-4" />
              {t('openInBrowser')}
            </button>
            <button
              onClick={() => exportAnnotations("manifest", false)}
              className={menuItem}
              role="menuitem"
            >
              <Download className="h-4 w-4" />
              {t('downloadFile')}
            </button>

            <div className="border-t border-[var(--ds-border)] my-1" />

            {/* TEI/XML */}
            <div className={sectionLabel}>TEI/XML</div>
            <button
              onClick={() => exportAnnotations("tei", true)}
              className={menuItem}
              role="menuitem"
            >
              <ExternalLink className="h-4 w-4" />
              {t('openInBrowser')}
            </button>
            <button
              onClick={() => exportAnnotations("tei", false)}
              className={menuItem}
              role="menuitem"
            >
              <Download className="h-4 w-4" />
              {t('downloadFile')}
            </button>

            <div className="border-t border-[var(--ds-border)] my-1" />

            {/* JSON */}
            <div className={sectionLabel}>JSON</div>
            <button
              onClick={() => exportAnnotations("json", true)}
              className={menuItem}
              role="menuitem"
            >
              <ExternalLink className="h-4 w-4" />
              {t('openInBrowser')}
            </button>
            <button
              onClick={() => exportAnnotations("json", false)}
              className={menuItem}
              role="menuitem"
            >
              <Download className="h-4 w-4" />
              {t('downloadFile')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

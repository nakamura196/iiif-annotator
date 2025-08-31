"use client";

import { useState, useRef, useEffect } from "react";
import FirestoreAnnotationAdapter from "@/lib/FirestoreAnnotationAdapter";
import { createTEI } from "@/lib/utils/export/tei/createTEI";
import { AnnotationWidthSingleBody } from "@/types/annotation";
import { createManifest } from "@/lib/utils/export/manifest/createManifest";
import { useTranslations } from 'next-intl';
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
    format: "json" | "csv" | "tei" | "manifest"
  ) => {
    if (!adapter) return;
    const annotations = await adapter.export();

    let content: string;
    let mimeType: string;
    let extension: string;
    let fileName: string;

    switch (format) {
      case "csv":
        content = annotations.items
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
    const a = document.createElement("a");
    a.href = url;
    const now = new Date().toISOString().replace(/[-:Z]/g, "");
    a.download = `${fileName}-${now}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md
          bg-blue-600 hover:bg-blue-700 
          dark:bg-blue-500 dark:hover:bg-blue-600
          text-white text-sm font-medium
          transition-colors duration-200 cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
        {t('exportButton')}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-md shadow-lg 
          bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5"
        >
          <div className="py-1" role="menu">
            <button
              onClick={() => exportAnnotations("manifest")}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 
                hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              role="menuitem"
            >
              {t('exportManifest')}
            </button>
            <button
              onClick={() => exportAnnotations("tei")}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 
                hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              role="menuitem"
            >
              {t('exportTEI')}
            </button>
            <button
              onClick={() => exportAnnotations("json")}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 
                hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              role="menuitem"
            >
              {t('exportJSON')}
            </button>
            {/*
            <button
              onClick={() => exportAnnotations("txt")}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 
                hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              role="menuitem"
            >
              テキスト形式でダウンロード
            </button>
            */}
          </div>
        </div>
      )}
    </div>
  );
};

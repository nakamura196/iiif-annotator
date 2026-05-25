"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Canvas } from "@iiif/presentation-3";
import { useTranslations } from "next-intl";
import { List, Grid2X2 } from "lucide-react";

interface SidebarThumbnailsProps {
  canvases: Canvas[];
  currentPage: number;
  onPageChange: (page: number) => void;
}

function getThumbnailUrl(canvas: Canvas): string | null {
  const thumbnail = canvas.thumbnail as
    | Array<{ id: string; type?: string }>
    | undefined;
  if (thumbnail && thumbnail.length > 0 && thumbnail[0].id) {
    return thumbnail[0].id;
  }

  const annotationPage = canvas.items?.[0];
  const annotation = annotationPage?.items?.[0];
  if (!annotation) return null;

  const body = annotation.body as {
    id: string;
    service?: Array<{ "@id"?: string; id?: string; type?: string }>;
  };

  if (body.service && body.service.length > 0) {
    const service = body.service[0];
    const serviceUrl = service["@id"] || service.id;
    if (serviceUrl) {
      return `${serviceUrl}/full/,200/0/default.jpg`;
    }
  }

  return body.id || null;
}

function getCanvasLabel(canvas: Canvas, index: number): string {
  const label = canvas.label as { [key: string]: string[] } | undefined;
  return (
    label?.ja?.[0] ||
    label?.en?.[0] ||
    label?.none?.[0] ||
    `${index + 1}`
  );
}

const activeThumb = "ring-2 ring-[var(--ds-primary)] bg-[var(--ds-surface-2)]";
const inactiveThumb = "hover:bg-[var(--ds-surface-2)] opacity-70 hover:opacity-100";
const activeLabel = "text-[var(--ds-primary)] font-medium";
const inactiveLabel = "text-[var(--ds-fg-muted)]";

export function SidebarThumbnails({
  canvases,
  currentPage,
  onPageChange,
}: SidebarThumbnailsProps) {
  const t = useTranslations("Editor");
  const [layout, setLayout] = useState<"single" | "grid">("single");
  const thumbnailRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const setRef = useCallback(
    (index: number, el: HTMLButtonElement | null) => {
      if (el) thumbnailRefs.current.set(index, el);
      else thumbnailRefs.current.delete(index);
    },
    []
  );

  useEffect(() => {
    const el = thumbnailRefs.current.get(currentPage);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentPage]);

  const layoutBtn = (active: boolean) =>
    `p-1 rounded transition-colors ${
      active
        ? "bg-[var(--ds-bg)] text-[var(--ds-fg)] shadow-sm"
        : "text-[var(--ds-fg-muted)] hover:text-[var(--ds-fg)]"
    }`;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
      {/* Layout toggle */}
      <div className="flex justify-end px-2 py-1 border-b border-[var(--ds-border)] flex-shrink-0">
        <div className="flex gap-0.5 bg-[var(--ds-surface-2)] rounded p-0.5">
          <button
            onClick={() => setLayout("single")}
            className={layoutBtn(layout === "single")}
            title={t("layoutSingle")}
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setLayout("grid")}
            className={layoutBtn(layout === "grid")}
            title={t("layoutGrid")}
          >
            <Grid2X2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Thumbnail list */}
      <div className={`flex-1 overflow-y-auto p-2 ${layout === "grid" ? "grid grid-cols-2 gap-2 auto-rows-min" : "flex flex-col gap-2"}`}>
        {canvases.map((canvas, index) => {
          const url = getThumbnailUrl(canvas);
          const isActive = index === currentPage;
          const label = getCanvasLabel(canvas, index);

          return layout === "single" ? (
            <button
              key={canvas.id || index}
              ref={(el) => setRef(index, el)}
              onClick={() => onPageChange(index)}
              className={`flex items-center gap-3 p-2 rounded transition-all w-full text-left
                ${isActive ? activeThumb : inactiveThumb}`}
              title={`${t("page", { current: index + 1, total: canvases.length })}: ${label}`}
            >
              {url ? (
                <img
                  src={url}
                  alt={label}
                  className="h-20 w-auto max-w-[60px] object-contain rounded flex-shrink-0"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector(".fallback")) {
                      const fallback = document.createElement("div");
                      fallback.className =
                        "fallback h-20 w-14 bg-[var(--ds-surface-2)] rounded flex items-center justify-center text-sm text-[var(--ds-fg-muted)] flex-shrink-0";
                      fallback.textContent = String(index + 1);
                      parent.insertBefore(fallback, target);
                    }
                  }}
                />
              ) : (
                <div className="h-20 w-14 bg-[var(--ds-surface-2)] rounded flex items-center justify-center text-sm text-[var(--ds-fg-muted)] flex-shrink-0">
                  {index + 1}
                </div>
              )}
              <span className={`text-xs leading-tight truncate ${isActive ? activeLabel : inactiveLabel}`}>
                {label}
              </span>
            </button>
          ) : (
            <button
              key={canvas.id || index}
              ref={(el) => setRef(index, el)}
              onClick={() => onPageChange(index)}
              className={`flex flex-col items-center gap-1 p-1.5 rounded transition-all
                ${isActive ? activeThumb : inactiveThumb}`}
              title={`${t("page", { current: index + 1, total: canvases.length })}: ${label}`}
            >
              {url ? (
                <img
                  src={url}
                  alt={label}
                  className="w-full h-auto max-h-32 object-contain rounded"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector(".fallback")) {
                      const fallback = document.createElement("div");
                      fallback.className =
                        "fallback h-24 w-full bg-[var(--ds-surface-2)] rounded flex items-center justify-center text-sm text-[var(--ds-fg-muted)]";
                      fallback.textContent = String(index + 1);
                      parent.insertBefore(fallback, target);
                    }
                  }}
                />
              ) : (
                <div className="h-24 w-full bg-[var(--ds-surface-2)] rounded flex items-center justify-center text-sm text-[var(--ds-fg-muted)]">
                  {index + 1}
                </div>
              )}
              <span className={`text-xs leading-tight truncate w-full text-center ${isActive ? activeLabel : inactiveLabel}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

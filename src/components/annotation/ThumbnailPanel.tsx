"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Canvas } from "@iiif/presentation-3";
import { useTranslations } from "next-intl";
import { PanelBottomOpen, PanelBottomClose } from "lucide-react";

interface ThumbnailPanelProps {
  canvases: Canvas[];
  currentPage: number;
  onPageChange: (page: number) => void;
}

function getThumbnailUrl(canvas: Canvas): string | null {
  // 1. Use canvas.thumbnail if available
  const thumbnail = canvas.thumbnail as
    | Array<{ id: string; type?: string }>
    | undefined;
  if (thumbnail && thumbnail.length > 0 && thumbnail[0].id) {
    return thumbnail[0].id;
  }

  // 2. Derive from IIIF Image API service
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
      const isV3 =
        service.type === "ImageService3" ||
        serviceUrl.includes("/iiif/3/");
      return isV3
        ? `${serviceUrl}/full/,150/0/default.jpg`
        : `${serviceUrl}/full/,150/0/default.jpg`;
    }
  }

  // 3. Fallback to full image URL
  return body.id || null;
}

const fallbackClass =
  "fallback h-20 w-14 bg-[var(--ds-surface-2)] rounded flex items-center justify-center text-xs text-[var(--ds-fg-muted)]";

export function ThumbnailPanel({
  canvases,
  currentPage,
  onPageChange,
}: ThumbnailPanelProps) {
  const t = useTranslations("Editor");
  const [isOpen, setIsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const setThumbnailRef = useCallback(
    (index: number, el: HTMLButtonElement | null) => {
      if (el) {
        thumbnailRefs.current.set(index, el);
      } else {
        thumbnailRefs.current.delete(index);
      }
    },
    []
  );

  // Scroll current thumbnail into view when page changes
  useEffect(() => {
    const el = thumbnailRefs.current.get(currentPage);
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentPage]);

  if (canvases.length <= 1) return null;

  return (
    <div className="border-t border-[var(--ds-border)] bg-[var(--ds-surface)]">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-1.5 py-1 text-xs text-[var(--ds-fg-muted)]
          hover:text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)] transition-colors"
        title={t("thumbnails")}
      >
        {isOpen ? (
          <PanelBottomClose className="h-3.5 w-3.5" />
        ) : (
          <PanelBottomOpen className="h-3.5 w-3.5" />
        )}
        <span>
          {t("thumbnails")} ({canvases.length})
        </span>
      </button>

      {/* Thumbnail strip */}
      {isOpen && (
        <div
          ref={scrollRef}
          className="flex gap-1.5 p-2 overflow-x-auto scrollbar-thin"
        >
          {canvases.map((canvas, index) => {
            const url = getThumbnailUrl(canvas);
            const isActive = index === currentPage;
            const label =
              (
                canvas.label as
                  | { [key: string]: string[] }
                  | undefined
              )?.ja?.[0] ||
              (
                canvas.label as
                  | { [key: string]: string[] }
                  | undefined
              )?.en?.[0] ||
              (
                canvas.label as
                  | { [key: string]: string[] }
                  | undefined
              )?.none?.[0] ||
              `${index + 1}`;

            return (
              <button
                key={canvas.id || index}
                ref={(el) => setThumbnailRef(index, el)}
                onClick={() => onPageChange(index)}
                className={`flex-shrink-0 flex flex-col items-center gap-0.5 p-1 rounded transition-all
                  ${
                    isActive
                      ? "ring-2 ring-[var(--ds-primary)] bg-[var(--ds-surface-2)]"
                      : "hover:bg-[var(--ds-surface-2)] opacity-70 hover:opacity-100"
                  }`}
                title={label}
              >
                {url ? (
                  <img
                    src={url}
                    alt={label}
                    className="h-20 w-auto max-w-[80px] object-contain rounded"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector(".fallback")) {
                        const fallback = document.createElement("div");
                        fallback.className = fallbackClass;
                        fallback.textContent = String(index + 1);
                        parent.insertBefore(fallback, target);
                      }
                    }}
                  />
                ) : (
                  <div className={fallbackClass}>
                    {index + 1}
                  </div>
                )}
                <span
                  className={`text-[10px] leading-tight max-w-[80px] truncate
                    ${
                      isActive
                        ? "text-[var(--ds-primary)] font-medium"
                        : "text-[var(--ds-fg-muted)]"
                    }`}
                >
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

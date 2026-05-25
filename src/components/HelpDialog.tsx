"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { MarkdownContent } from "@nakamura196/react-ui";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Quick-access help overlay. Loads the same Markdown as the /help page and
 *  renders it with the DS MarkdownContent. */
export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const params = useParams();
  const locale = (params.locale as string) || "ja";
  const t = useTranslations("Common");
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Load the doc once opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/docs/usage.${locale}.md`);
        const text = res.ok
          ? await res.text()
          : await (await fetch("/docs/usage.en.md")).text();
        if (!cancelled) setContent(text);
      } catch {
        if (!cancelled) setContent("# Error\nFailed to load documentation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, locale]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-lg shadow-xl bg-[var(--ds-bg)] border border-[var(--ds-border)]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ds-border)] flex-shrink-0">
          <h2
            className="text-lg font-semibold text-[var(--ds-fg)]"
            style={{ fontFamily: "var(--ds-font-serif)" }}
          >
            {t("help")}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[var(--ds-fg-muted)] hover:text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)] transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--ds-primary)]" />
            </div>
          ) : (
            <MarkdownContent content={content} />
          )}
        </div>
      </div>
    </div>
  );
}

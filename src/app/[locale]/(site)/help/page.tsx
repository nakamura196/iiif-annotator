"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MarkdownContent } from "@nakamura196/react-ui";

export default function HelpPage() {
  const params = useParams();
  const locale = params.locale as string;
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDoc = async () => {
      try {
        const response = await fetch(`/docs/usage.${locale}.md`);
        if (!response.ok) {
          // Fallback to English if locale file not found
          const fallbackResponse = await fetch("/docs/usage.en.md");
          setContent(await fallbackResponse.text());
        } else {
          setContent(await response.text());
        }
      } catch (error) {
        console.error("Error loading documentation:", error);
        setContent("# Error\nFailed to load documentation.");
      } finally {
        setLoading(false);
      }
    };

    loadDoc();
  }, [locale]);

  return (
    <div className="min-h-screen bg-[var(--ds-surface)]">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto bg-[var(--ds-bg)] border border-[var(--ds-border)] rounded-lg shadow-sm p-8">
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

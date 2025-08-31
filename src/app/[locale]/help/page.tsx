"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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
          const text = await fallbackResponse.text();
          setContent(text);
        } else {
          const text = await response.text();
          setContent(text);
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

  const renderMarkdown = (markdown: string) => {
    // Simple markdown to HTML conversion
    let html = markdown
      // Headers - process from smallest to largest to avoid conflicts
      .replace(/^#### (.*$)/gim, '<h4 class="text-base font-medium mt-4 mb-2 text-gray-900 dark:text-gray-100">$1</h4>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-3 text-gray-900 dark:text-gray-100">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-8 mb-4 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      // Lists - handle indented lists first
      .replace(/^   - (.+)/gim, '<li class="ml-8 list-disc">$1</li>')
      .replace(/^   \* (.+)/gim, '<li class="ml-8 list-disc">$1</li>')
      .replace(/^  - (.+)/gim, '<li class="ml-8 list-disc">$1</li>')
      .replace(/^  \* (.+)/gim, '<li class="ml-8 list-disc">$1</li>')
      .replace(/^\* (.+)/gim, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^- (.+)/gim, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^\d+\. (.+)/gim, '<li class="ml-4 list-decimal">$1</li>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Code blocks
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">$1</code>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p class="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">');

    // Wrap lists
    html = html.replace(/(<li class="ml-4 list-disc">.*<\/li>)/, function(match) {
      return '<ul class="mb-4 space-y-1">' + match + '</ul>';
    });
    html = html.replace(/(<li class="ml-4 list-decimal">.*<\/li>)/, function(match) {
      return '<ol class="mb-4 space-y-1">' + match + '</ol>';
    });

    return '<div class="prose prose-lg dark:prose-invert max-w-none"><p class="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">' + html + '</p></div>';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        .markdown-content :global(h1:not(:first-child)) {
          margin-top: 2rem;
        }
        .markdown-content :global(h2:not(:first-child)) {
          margin-top: 1.5rem;
        }
        .markdown-content :global(h3:not(:first-child)) {
          margin-top: 1.25rem;
        }
        .markdown-content :global(ul ul),
        .markdown-content :global(ol ol),
        .markdown-content :global(ul ol),
        .markdown-content :global(ol ul) {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}
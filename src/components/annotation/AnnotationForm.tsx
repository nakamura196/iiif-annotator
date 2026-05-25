"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from 'next-intl';
import { buttonClass } from "@nakamura196/react-ui";

import ClientSideCustomEditor from "@/components/client-side-custom-editor";

import "ckeditor5/ckeditor5.css";
import "ckeditor5-premium-features/ckeditor5-premium-features.css";

interface AnnotationFormProps {
  id: string;
  text: string;
  onChange: (text: string) => void;
  onDelete: (ids: string[]) => void;
}

export function AnnotationForm({
  id,
  text,
  onChange,
  onDelete,
}: AnnotationFormProps) {
  // エディタの内容を保持するための状態
  const [editorContent, setEditorContent] = useState(text);
  const t = useTranslations('Editor');

  useEffect(() => {
    setEditorContent(text);
  }, [text]);

  // フォーム送信時の処理
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange(editorContent);
  };

  return (
    <div className="p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-semibold text-[var(--ds-fg)] mb-4 sm:mb-6">
        {t('annotationDetails')}
      </h3>
      <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
        <div className="bg-[var(--ds-bg)] rounded-md">
          <ClientSideCustomEditor
            data={editorContent}
            onChange={(data) => setEditorContent(data)}
            placeholder={t('enterText')}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button type="submit" className={buttonClass("primary", "sm", "flex-1")}>
            {t('saveChanges')}
            <kbd className="ml-2 px-1.5 py-0.5 text-xs font-mono rounded bg-white/20">⌘S</kbd>
          </button>
          {id && (
            <button
              type="button"
              onClick={() => onDelete([id])}
              className="inline-flex items-center justify-center gap-2 rounded-lg
                px-3 sm:px-4 py-1.5 text-sm font-medium transition-colors
                bg-[var(--ds-bg)] border border-red-300 dark:border-red-700
                text-red-600 dark:text-red-400
                hover:bg-red-50 dark:hover:bg-red-900/30
                focus:outline-none focus:ring-2 focus:ring-red-500/60 focus:ring-offset-2"
            >
              <Trash2 className="w-4 h-4" /> {t('deleteAnnotation')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

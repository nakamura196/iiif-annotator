"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from 'next-intl';

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
      <h3
        className="text-lg sm:text-xl font-semibold text-gray-800 
        dark:text-gray-100 mb-4 sm:mb-6"
      >
        {t('annotationDetails')}
      </h3>
      <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-gray-800 rounded-md">
          <ClientSideCustomEditor
            data={editorContent}
            onChange={(data) => setEditorContent(data)}
            placeholder={t('enterText')}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            type="submit"
            className="flex-1 bg-blue-600 dark:bg-blue-500 text-white
              px-3 sm:px-4 py-2 rounded-md text-sm sm:text-base
              cursor-pointer hover:bg-blue-700 dark:hover:bg-blue-600
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:focus:ring-blue-400 focus:ring-offset-2
              dark:focus:ring-offset-gray-900
              transition-colors duration-200 font-medium
              flex items-center justify-center"
          >
            {t('saveChanges')}
            <kbd className="ml-2 px-1.5 py-0.5 text-xs font-mono bg-blue-500 dark:bg-blue-400 rounded">⌘S</kbd>
          </button>
          {id && (
            <button
              type="button"
              onClick={() => onDelete([id])}
              className="px-3 sm:px-4 py-2 rounded-md text-sm sm:text-base 
                font-medium transition-colors duration-150 ease-in-out
                cursor-pointer flex items-center justify-center
                bg-white dark:bg-gray-800 border border-red-200 
                dark:border-red-700 text-red-600 dark:text-red-400
                hover:bg-red-50 dark:hover:bg-red-900/30 
                focus:outline-none focus:ring-2 focus:ring-red-500 
                dark:focus:ring-red-400 focus:ring-offset-2
                dark:focus:ring-offset-gray-900"
            >
              <Trash2 className="w-4 h-4 mr-2" /> {t('deleteAnnotation')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus } from "lucide-react";
import { useTranslations } from 'next-intl';
import { buttonClass } from "@nakamura196/react-ui";

import ClientSideCustomEditor from "@/components/client-side-custom-editor";
import { MetadataField } from "@/types/annotation";

import "ckeditor5/ckeditor5.css";
import "ckeditor5-premium-features/ckeditor5-premium-features.css";

interface VocabularyOption {
  id: string;
  name: string;
}

interface AnnotationFormProps {
  id: string;
  text: string;
  metadata?: MetadataField[];
  /** 選択中の語彙のプロパティ（入力候補）。 */
  vocabulary?: string[];
  /** 選択可能な語彙一覧（手動選択用）。 */
  vocabularies?: VocabularyOption[];
  selectedVocabId?: string;
  onSelectVocab?: (id: string) => void;
  onChange: (text: string, metadata: MetadataField[]) => void;
  onDelete: (ids: string[]) => void;
}

const VOCAB_DATALIST_ID = "metadata-vocab-options";

export function AnnotationForm({
  id,
  text,
  metadata,
  vocabulary = [],
  vocabularies = [],
  selectedVocabId = "",
  onSelectVocab,
  onChange,
  onDelete,
}: AnnotationFormProps) {
  // エディタの内容を保持するための状態
  const [editorContent, setEditorContent] = useState(text);
  // メタデータ(key-value)行の状態
  const [rows, setRows] = useState<MetadataField[]>(metadata || []);
  const t = useTranslations('Editor');

  useEffect(() => {
    setEditorContent(text);
  }, [text]);

  // 選択中アノテーションが変わったら metadata を反映
  useEffect(() => {
    setRows(metadata || []);
  }, [metadata]);

  const updateRow = (index: number, patch: Partial<MetadataField>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { label: "", value: "" }]);
  };

  // フォーム送信時の処理
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange(editorContent, rows);
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

        {/* メタデータ (項目名 + 値)。@container にして、サイドバー幅に応じて
            行レイアウトを縦積み ↔ 横並びに切り替える。 */}
        <div className="space-y-2 @container">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-[var(--ds-fg)]">{t('metadata')}</p>
            {vocabularies.length > 0 && (
              <select
                value={selectedVocabId}
                onChange={(e) => onSelectVocab?.(e.target.value)}
                title={t('selectVocabulary')}
                className="text-sm p-1.5 border rounded-md bg-[var(--ds-bg)]
                  border-[var(--ds-border)] text-[var(--ds-fg)] max-w-[55%]"
              >
                {vocabularies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {vocabulary.length > 0 && (
            <datalist id={VOCAB_DATALIST_ID}>
              {vocabulary.map((field) => (
                <option key={field} value={field} />
              ))}
            </datalist>
          )}
          {/* 狭いサイドバー幅でも入力しやすいよう、コンテナ幅に応じて
              縦積み(narrow) ↔ 横並び(wide) を切り替える（@container クエリ）。 */}
          {rows.map((row, index) => (
            <div
              key={index}
              className="flex flex-col @sm:flex-row @sm:items-center gap-2"
            >
              <input
                type="text"
                list={VOCAB_DATALIST_ID}
                value={row.label}
                onChange={(e) => updateRow(index, { label: e.target.value })}
                placeholder={t('metadataLabelPlaceholder')}
                className="w-full @sm:w-2/5 p-2 text-sm border rounded-md bg-[var(--ds-bg)]
                  border-[var(--ds-border)] text-[var(--ds-fg)]"
              />
              <div className="flex items-center gap-2 w-full @sm:flex-1">
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => updateRow(index, { value: e.target.value })}
                  placeholder={t('metadataValuePlaceholder')}
                  className="flex-1 min-w-0 p-2 text-sm border rounded-md bg-[var(--ds-bg)]
                    border-[var(--ds-border)] text-[var(--ds-fg)]"
                />
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="p-2 shrink-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                  title={t('removeMetadataField')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 text-sm text-[var(--ds-primary)] hover:underline"
          >
            <Plus className="w-4 h-4" /> {t('addMetadataField')}
          </button>
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

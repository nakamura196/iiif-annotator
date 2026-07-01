import type { AnnotationWithMultipleBodies } from "@/types/annotation";
import { useTranslations } from 'next-intl';
import { Crosshair, Trash2, CheckSquare, Square } from 'lucide-react';
import { useState, useMemo } from 'react';

interface AnnotationListProps {
  annotations: AnnotationWithMultipleBodies[];
  onDelete: (ids: string[]) => void;
  onSelect: (annotationId: string) => void;
  onFocus: (annotationId: string) => void;
  selectedId?: string;
}

type SortOption = 'created-desc' | 'created-asc' | 'text-asc' | 'text-desc';

const getMetadataFields = (annotation: AnnotationWithMultipleBodies) =>
  (annotation.metadata || []).filter((m) => m?.label?.trim() || m?.value?.trim());

const getTags = (annotation: AnnotationWithMultipleBodies) =>
  (annotation.tags || []).filter((t) => typeof t === 'string' && t.trim());

const getAnnotationText = (annotation: AnnotationWithMultipleBodies) => {
  // Handle both array and object body formats
  if (Array.isArray(annotation.body)) {
    return annotation.body?.[0]?.value || "";
  }
  // Handle object format (from Firestore)
  if (annotation.body && typeof annotation.body === 'object') {
    return (annotation.body as { value?: string }).value || "";
  }
  return "";
};

const getTimeAgo = (timestamp: unknown, locale: string): string => {
  if (!timestamp) return '';

  // Handle Firestore timestamp format with type field
  let seconds: number;
  if (typeof timestamp === 'object' && timestamp !== null) {
    const ts = timestamp as { seconds?: number; type?: string };
    if (ts.seconds !== undefined) {
      seconds = ts.seconds;
    } else {
      return '';
    }
  } else {
    return '';
  }

  const now = Date.now();
  const created = seconds * 1000;
  const diff = now - created;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (locale === 'ja') {
    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    return `${days}日前`;
  } else {
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
};

export function AnnotationList({
  annotations,
  onSelect,
  onFocus,
  onDelete,
  selectedId,
}: AnnotationListProps) {
  const t = useTranslations('AnnotationList');
  const [sortOption, setSortOption] = useState<SortOption>('created-asc');
  const [tagMode, setTagMode] = useState<'all' | 'exclude-ocr' | 'only-ocr'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const locale = t('locale') || 'en';

  // Helper function to get seconds from timestamp
  const getSeconds = (timestamp: unknown): number => {
    if (!timestamp || typeof timestamp !== 'object') return 0;
    const ts = timestamp as { seconds?: number };
    return ts.seconds || 0;
  };

  // Sort annotations based on selected option
  const sortedAnnotations = useMemo(() => {
    const sorted = [...annotations];

    switch (sortOption) {
      case 'created-desc':
        return sorted.sort((a, b) => {
          const aTime = getSeconds(a.created);
          const bTime = getSeconds(b.created);
          return bTime - aTime;
        });
      case 'created-asc':
        return sorted.sort((a, b) => {
          const aTime = getSeconds(a.created);
          const bTime = getSeconds(b.created);
          return aTime - bTime;
        });
      case 'text-asc':
        return sorted.sort((a, b) => {
          const aText = getAnnotationText(a).toLowerCase();
          const bText = getAnnotationText(b).toLowerCase();
          return aText.localeCompare(bText);
        });
      case 'text-desc':
        return sorted.sort((a, b) => {
          const aText = getAnnotationText(a).toLowerCase();
          const bText = getAnnotationText(b).toLowerCase();
          return bText.localeCompare(aText);
        });
      default:
        return sorted;
    }
  }, [annotations, sortOption]);

  // タグ絞り込み（OCR除外 / OCRのみ）。表示のみに作用し、選択操作は全件対象のまま。
  const visibleAnnotations = useMemo(() => {
    if (tagMode === 'all') return sortedAnnotations;
    const hasOcr = (a: AnnotationWithMultipleBodies) => (a.tags || []).includes('OCR');
    return sortedAnnotations.filter((a) => (tagMode === 'exclude-ocr' ? !hasOcr(a) : hasOcr(a)));
  }, [sortedAnnotations, tagMode]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === annotations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(annotations.map(a => a.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size > 0 && confirm(t('confirmBulkDelete', { count: selectedIds.size }))) {
      onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSelectionMode(false);
    }
  };

  const handleCancelSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div
        className="px-3 sm:px-4 py-2 sm:py-3 bg-[var(--ds-surface)]
            border-b border-[var(--ds-border)] flex-shrink-0"
      >
        {selectionMode ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="p-1.5 rounded hover:bg-[var(--ds-surface-2)] transition-colors"
                title={selectedIds.size === annotations.length ? t('deselectAll') : t('selectAll')}
              >
                {selectedIds.size === annotations.length ? (
                  <CheckSquare className="w-5 h-5 text-[var(--ds-primary)]" />
                ) : (
                  <Square className="w-5 h-5 text-[var(--ds-fg-muted)]" />
                )}
              </button>
              <span className="text-sm text-[var(--ds-fg)]">
                {t('selectedCount', { count: selectedIds.size })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded
                  hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {t('delete')}
              </button>
              <button
                onClick={handleCancelSelection}
                className="px-3 py-1.5 text-sm text-[var(--ds-fg)]
                  hover:bg-[var(--ds-surface-2)] rounded transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm sm:text-base font-medium text-[var(--ds-fg)]">
              {t('annotations')}{" "}
              <span className="text-[var(--ds-fg-muted)] font-normal">
                ({annotations.length})
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectionMode(true)}
                className="text-xs px-2 py-1 rounded border border-[var(--ds-border)]
                  bg-[var(--ds-bg)] text-[var(--ds-fg)]
                  hover:bg-[var(--ds-surface-2)] transition-colors"
                title={t('selectMode')}
              >
                <CheckSquare className="w-4 h-4" />
              </button>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="text-xs px-2 py-1 rounded border border-[var(--ds-border)]
                  bg-[var(--ds-bg)] text-[var(--ds-fg)]
                  hover:bg-[var(--ds-surface-2)] cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]"
              >
                <option value="created-desc">{t('sortNewest')}</option>
                <option value="created-asc">{t('sortOldest')}</option>
                <option value="text-asc">{t('sortTextAsc')}</option>
                <option value="text-desc">{t('sortTextDesc')}</option>
              </select>
              <select
                value={tagMode}
                onChange={(e) => setTagMode(e.target.value as typeof tagMode)}
                title={t('tagFilter')}
                className="text-xs px-2 py-1 rounded border border-[var(--ds-border)]
                  bg-[var(--ds-bg)] text-[var(--ds-fg)]
                  hover:bg-[var(--ds-surface-2)] cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]"
              >
                <option value="all">{t('tagAll')}</option>
                <option value="exclude-ocr">{t('tagExcludeOcr')}</option>
                <option value="only-ocr">{t('tagOnlyOcr')}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {visibleAnnotations.map((annotation) => {
          const text = getAnnotationText(annotation);
          const metadataFields = getMetadataFields(annotation);
          const tags = getTags(annotation);
          const createdAgo = getTimeAgo(annotation.created, locale);
          const modifiedAgo = getTimeAgo(annotation.modified, locale);
          const isSelected = selectedIds.has(annotation.id);

          return (
            <div
              key={annotation.id}
              className={`
                    px-3 sm:px-4 py-2 sm:py-3
                    border-b border-[var(--ds-border)]
                    last:border-b-0
                    transition-colors duration-150 ease-in-out
                    flex items-center gap-2
                ${
                  selectedId === annotation.id
                    ? "bg-[var(--ds-surface-2)]"
                    : isSelected
                    ? "bg-[var(--ds-surface-2)]"
                    : "hover:bg-[var(--ds-surface)]"
                }
              `}
            >
              {selectionMode && (
                <button
                  onClick={() => toggleSelection(annotation.id)}
                  className="p-1 flex-shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-[var(--ds-primary)]" />
                  ) : (
                    <Square className="w-5 h-5 text-[var(--ds-fg-muted)]" />
                  )}
                </button>
              )}
              <div
                onClick={() => !selectionMode && onSelect(annotation.id)}
                className={`flex-1 min-w-0 ${!selectionMode ? 'cursor-pointer' : ''}`}
              >
                {text ? (
                  <div
                    className="text-sm sm:text-base text-[var(--ds-fg)] line-clamp-2"
                    dangerouslySetInnerHTML={{
                      __html: text,
                    }}
                  />
                ) : (
                  <div className="text-sm sm:text-base text-[var(--ds-fg-muted)] italic">
                    {t('emptyText')}
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-1.5 py-0.5
                          rounded text-[11px] leading-tight font-medium
                          bg-[var(--ds-primary)] text-white"
                        title={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {metadataFields.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {metadataFields.map((field, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5
                          rounded text-[11px] leading-tight
                          bg-[var(--ds-surface-2)] text-[var(--ds-fg-muted)]
                          border border-[var(--ds-border)]"
                        title={`${field.label}: ${field.value}`}
                      >
                        {field.label && (
                          <span className="font-medium text-[var(--ds-fg)]">
                            {field.label}
                          </span>
                        )}
                        {field.value && <span className="truncate max-w-[140px]">{field.value}</span>}
                      </span>
                    ))}
                  </div>
                )}
                {(createdAgo || modifiedAgo) && (
                  <div className="text-xs text-[var(--ds-fg-muted)] mt-1 flex items-center gap-2">
                    {createdAgo && (
                      <span>{t('created')}: {createdAgo}</span>
                    )}
                    {createdAgo && modifiedAgo && (
                      <span className="text-[var(--ds-border)]">|</span>
                    )}
                    {modifiedAgo && (
                      <span>{t('modified')}: {modifiedAgo}</span>
                    )}
                  </div>
                )}
              </div>
              {!selectionMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocus(annotation.id);
                  }}
                  className="p-1.5 rounded hover:bg-[var(--ds-surface-2)]
                    text-[var(--ds-fg-muted)] hover:text-[var(--ds-primary)]
                    transition-colors flex-shrink-0"
                  title={t('focusAnnotation')}
                >
                  <Crosshair className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
        {annotations.length === 0 && (
          <div className="px-3 sm:px-4 py-4 text-center text-[var(--ds-fg-muted)] text-sm">
            {t('noAnnotations')}
          </div>
        )}
      </div>
    </div>
  );
}

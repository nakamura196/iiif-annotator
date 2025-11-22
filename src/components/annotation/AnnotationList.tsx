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
        className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800
            border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
      >
        {selectionMode ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title={selectedIds.size === annotations.length ? t('deselectAll') : t('selectAll')}
              >
                {selectedIds.size === annotations.length ? (
                  <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Square className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('selectedCount', { count: selectedIds.size })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded
                  hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {t('delete')}
              </button>
              <button
                onClick={handleCancelSelection}
                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300
                  hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p
              className="text-sm sm:text-base font-medium text-gray-900
                  dark:text-gray-100"
            >
              {t('annotations')}{" "}
              <span className="text-gray-500 dark:text-gray-400 font-normal">
                ({annotations.length})
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectionMode(true)}
                className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600
                  bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200
                  hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                title={t('selectMode')}
              >
                <CheckSquare className="w-4 h-4" />
              </button>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600
                  bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200
                  hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="created-desc">{t('sortNewest')}</option>
                <option value="created-asc">{t('sortOldest')}</option>
                <option value="text-asc">{t('sortTextAsc')}</option>
                <option value="text-desc">{t('sortTextDesc')}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {sortedAnnotations.map((annotation) => {
          const text = getAnnotationText(annotation);
          const createdAgo = getTimeAgo(annotation.created, locale);
          const modifiedAgo = getTimeAgo(annotation.modified, locale);
          const isSelected = selectedIds.has(annotation.id);

          return (
            <div
              key={annotation.id}
              className={`
                    px-3 sm:px-4 py-2 sm:py-3
                    border-b border-gray-200 dark:border-gray-700
                    last:border-b-0
                    transition-colors duration-150 ease-in-out
                    flex items-center gap-2
                ${
                  selectedId === annotation.id
                    ? "bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100dark:hover:bg-blue-900/40"
                    : isSelected
                    ? "bg-blue-100 dark:bg-blue-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }
              `}
            >
              {selectionMode && (
                <button
                  onClick={() => toggleSelection(annotation.id)}
                  className="p-1 flex-shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400 dark:text-gray-600" />
                  )}
                </button>
              )}
              <div
                onClick={() => !selectionMode && onSelect(annotation.id)}
                className={`flex-1 min-w-0 ${!selectionMode ? 'cursor-pointer' : ''}`}
              >
                {text ? (
                  <div
                    className="text-sm sm:text-base text-gray-600 dark:text-gray-300 line-clamp-2"
                    dangerouslySetInnerHTML={{
                      __html: text,
                    }}
                  />
                ) : (
                  <div className="text-sm sm:text-base text-gray-400 dark:text-gray-500 italic">
                    {t('emptyText')}
                  </div>
                )}
                {(createdAgo || modifiedAgo) && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-2">
                    {createdAgo && (
                      <span>{t('created')}: {createdAgo}</span>
                    )}
                    {createdAgo && modifiedAgo && (
                      <span className="text-gray-300 dark:text-gray-600">|</span>
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
                  className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700
                    text-gray-600 dark:text-gray-400 hover:text-blue-600
                    dark:hover:text-blue-400 transition-colors flex-shrink-0"
                  title={t('focusAnnotation')}
                >
                  <Crosshair className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
        {annotations.length === 0 && (
          <div
            className="px-3 sm:px-4 py-4 text-center text-gray-500 
            dark:text-gray-400 text-sm"
          >
            {t('noAnnotations')}
          </div>
        )}
      </div>
    </div>
  );
}

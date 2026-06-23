"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ChevronLeft, Folder, FileText, Grid3x3, List, ExternalLink } from "lucide-react";
import { convertPresentation2 } from "@iiif/parser/presentation-2";
import Image from "next/image";
import { ManifestViewer } from "@/components/ManifestViewer";
import { getIIIFLabel } from "@/lib/utils/iiifLabel";
import { buttonClass } from "@nakamura196/react-ui";

// IIIF Presentation API v3 types
interface IIIFV3Item {
  id: string;
  type: string;
  label: { [key: string]: string[] };
  summary?: { [key: string]: string[] };
  thumbnail?: Array<{
    id: string;
    type: string;
    format?: string;
  }>;
  metadata?: Array<{
    label: { [key: string]: string[] };
    value: { [key: string]: string[] };
  }>;
}

interface IIIFV3Collection {
  "@context"?: string | string[];
  id: string;
  type: string;
  label: { [key: string]: string[] };
  summary?: { [key: string]: string[] };
  items?: IIIFV3Item[];
}

function CollectionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const collectionUrl = searchParams.get("u");
  const parentCollectionUrl = searchParams.get("parent");
  const [collection, setCollection] = useState<IIIFV3Collection | null>(null);
  const [items, setItems] = useState<IIIFV3Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isManifestViewerOpen, setIsManifestViewerOpen] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    if (!collectionUrl) {
      setError(t('CollectionPage.noCollection'));
      return;
    }

    const fetchCollection = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(collectionUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch collection: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if it's v2 or v3
        let convertedData: IIIFV3Collection;
        
        if (data["@type"] === "sc:Collection" || data["@context"]?.includes("http://iiif.io/api/presentation/2/context.json")) {
          // It's v2, convert to v3
          convertedData = convertPresentation2(data) as IIIFV3Collection;
        } else {
          // It's already v3
          convertedData = data as IIIFV3Collection;
        }
        
        setCollection(convertedData);
        
        // Extract items
        const itemList = convertedData.items || [];
        setItems(itemList);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('CollectionPage.noCollection'));
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionUrl, t]);

  // v2/v3 どちらの label 形式にも対応する共有ヘルパーに委譲する
  const getLabel = (label: string | { [key: string]: string[] } | undefined): string =>
    getIIIFLabel(label, locale);

  const getSummary = (summary: { [key: string]: string[] } | undefined): string | null => {
    if (!summary) return null;
    
    let text: string | null = null;
    
    // Try to get current locale summary first
    if (locale in summary && Array.isArray(summary[locale])) {
      text = summary[locale][0] || null;
    }
    // Try Japanese
    else if ("ja" in summary && Array.isArray(summary.ja)) {
      text = summary.ja[0] || null;
    }
    // Fall back to first available language
    else {
      const firstLang = Object.keys(summary)[0];
      if (firstLang && Array.isArray(summary[firstLang])) {
        text = summary[firstLang][0] || null;
      }
    }
    
    // HTMLタグを除去
    if (text) {
      return text.replace(/<[^>]*>/g, '');
    }
    
    return null;
  };

  const getThumbnail = (thumbnail: IIIFV3Item["thumbnail"]): string | null => {
    if (!thumbnail || !Array.isArray(thumbnail) || thumbnail.length === 0) return null;
    return thumbnail[0].id || null;
  };

  const getMetadataValue = (metadata: IIIFV3Item["metadata"]): { label: string, value: string }[] => {
    if (!metadata || !Array.isArray(metadata)) return [];
    
    // 最初の3つのメタデータのみ表示（コンパクトにするため）
    return metadata.slice(0, 3).map(item => {
      const label = item.label[locale] ? item.label[locale][0] : 
                   item.label['ja'] ? item.label['ja'][0] : 
                   Object.values(item.label)[0]?.[0] || '';
      const value = item.value[locale] ? item.value[locale][0] : 
                   item.value['ja'] ? item.value['ja'][0] : 
                   Object.values(item.value)[0]?.[0] || '';
      return { label, value };
    });
  };

  const handleItemClick = (item: IIIFV3Item) => {
    const itemUrl = item.id;
    
    if (item.type === "Collection") {
      // Navigate to nested collection, keeping parent reference
      const query = new URLSearchParams();
      query.set("u", itemUrl);
      if (collectionUrl) {
        query.set("parent", collectionUrl);
      }
      router.push(`/collection?${query.toString()}`);
    } else if (item.type === "Manifest") {
      // Navigate to manifest viewer, keeping collection reference
      const query = new URLSearchParams();
      query.set("manifest", itemUrl);
      if (collectionUrl) {
        query.set("from", collectionUrl); // Add 'from' parameter for back navigation
      }
      router.push(`/item?${query.toString()}`);
    }
  };

  const handleBackClick = () => {
    if (parentCollectionUrl) {
      const query = new URLSearchParams();
      query.set("u", parentCollectionUrl);
      router.push(`/collection?${query.toString()}`);
    } else {
      router.push(`/`);
    }
  };

  if (!collectionUrl) {
    return (
      <div className="container mx-auto p-4">
        <Alert>
          <AlertDescription>
            {t('CollectionPage.noCollection')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Navigation */}
      <div className="mb-4">
        <button
          onClick={handleBackClick}
          className="flex items-center gap-2 text-[var(--ds-primary)] hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          {parentCollectionUrl ? t('CollectionPage.backToParent') : t('CollectionPage.backToHome')}
        </button>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">
          {collection ? getLabel(collection.label) : t('CollectionPage.title')}
        </h1>
        {collectionUrl && (
          <button
            onClick={() => setIsManifestViewerOpen(true)}
            className="p-2 text-[var(--ds-fg-muted)] hover:text-[var(--ds-fg)] transition-colors"
            title="View JSON"
          >
            <Image
              src="/IIIF-logo-colored-text.svg"
              alt="IIIF"
              width={40}
              height={20}
              style={{ height: "auto" }}
            />
          </button>
        )}
      </div>
      
      {collection?.summary && (
        <p className="text-[var(--ds-fg-muted)] mb-6">
          {getSummary(collection.summary)}
        </p>
      )}
      
      {items.length === 0 ? (
        <Alert>
          <AlertDescription>{t('CollectionPage.noItems')}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-[var(--ds-fg-muted)]">
              {items.length} {t('CollectionPage.items')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-[var(--ds-surface-2)] text-[var(--ds-primary)]'
                    : 'text-[var(--ds-fg-muted)] hover:bg-[var(--ds-surface-2)]'
                }`}
                title="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-[var(--ds-surface-2)] text-[var(--ds-primary)]'
                    : 'text-[var(--ds-fg-muted)] hover:bg-[var(--ds-surface-2)]'
                }`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, index) => {
              const thumbnailUrl = getThumbnail(item.thumbnail);
              const summary = getSummary(item.summary);
              const isCollection = item.type === "Collection";
              
              return (
                <Card 
                  key={index} 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleItemClick(item)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      {isCollection ? (
                        <Folder className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 flex-shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--ds-primary)] flex-shrink-0" />
                      )}
                      <span className="truncate">{getLabel(item.label)}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {thumbnailUrl && (
                      <img 
                        src={thumbnailUrl} 
                        alt={getLabel(item.label)}
                        className="w-full h-32 sm:h-48 object-cover rounded mb-2"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    {summary && (
                      <p className="text-sm text-[var(--ds-fg-muted)] mb-2 line-clamp-2">
                        {summary}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-[var(--ds-fg-muted)]">
                      <span className="px-2 py-1 bg-[var(--ds-surface-2)] rounded">
                        {isCollection ? t('CollectionPage.typeCollection') : t('CollectionPage.typeManifest')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => {
                const thumbnailUrl = getThumbnail(item.thumbnail);
                const summary = getSummary(item.summary);
                const isCollection = item.type === "Collection";
                const label = getLabel(item.label);
                const metadata = getMetadataValue(item.metadata);
                
                return (
                  <div
                    key={index}
                    className="p-3 sm:p-4 bg-[var(--ds-bg)]
                      border border-[var(--ds-border)] rounded-lg
                      hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* サムネイル - モバイルでは上部に表示 */}
                      {thumbnailUrl && (
                        <img 
                          src={thumbnailUrl} 
                          alt={label}
                          className="w-full sm:w-20 h-32 sm:h-20 object-cover rounded flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      
                      {/* コンテンツ */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-[var(--ds-fg)] flex items-center gap-2">
                              {isCollection ? (
                                <Folder className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                              ) : (
                                <FileText className="h-4 w-4 text-[var(--ds-primary)] flex-shrink-0" />
                              )}
                              <span className="select-text break-words">{label}</span>
                            </h3>
                            
                            {summary && (
                              <p className="text-sm text-[var(--ds-fg-muted)] mt-1 line-clamp-2 select-text">
                                {summary}
                              </p>
                            )}
                            
                            {/* メタデータ - モバイルでは縦に並べる */}
                            {metadata.length > 0 && (
                              <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-3 text-xs">
                                {metadata.map((item, idx) => (
                                  <div key={idx} className="flex gap-1">
                                    <span className="text-[var(--ds-fg-muted)] select-text">{item.label}:</span>
                                    <span className="text-[var(--ds-fg)] select-text break-words">{item.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-2 text-xs text-[var(--ds-fg-muted)]">
                              <span className="px-2 py-0.5 bg-[var(--ds-surface-2)] rounded inline-block">
                                {isCollection ? t('CollectionPage.typeCollection') : t('CollectionPage.typeManifest')}
                              </span>
                              <span className="text-[var(--ds-fg-muted)] select-text truncate" title={item.id}>
                                {item.id}
                              </span>
                            </div>
                          </div>
                          
                          {/* ボタン - モバイルでは幅いっぱいに */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item);
                            }}
                            className={buttonClass("primary", "sm", "w-full sm:w-auto gap-1 flex-shrink-0")}
                          >
                            {isCollection ? (
                              <>
                                <Folder className="h-4 w-4" />
                                {t('CollectionPage.open')}
                              </>
                            ) : (
                              <>
                                <ExternalLink className="h-4 w-4" />
                                {t('CollectionPage.edit')}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      
      {/* Manifest Viewer Modal */}
      {collectionUrl && (
        <ManifestViewer
          manifestUrl={collectionUrl}
          isOpen={isManifestViewerOpen}
          onClose={() => setIsManifestViewerOpen(false)}
        />
      )}
    </div>
  );
}

export default function CollectionPage() {
  const t = useTranslations();
  return (
    <Suspense fallback={<div className="container mx-auto p-4">{t('CollectionPage.loading')}</div>}>
      <CollectionContent />
    </Suspense>
  );
}
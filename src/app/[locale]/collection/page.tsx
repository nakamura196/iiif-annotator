"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ChevronLeft, Folder, FileText, Grid3x3, List, ExternalLink } from "lucide-react";
import { convertPresentation2 } from "@iiif/parser/presentation-2";

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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
          console.log("Converting IIIF v2 collection to v3");
          convertedData = convertPresentation2(data) as IIIFV3Collection;
        } else {
          // It's already v3
          convertedData = data as IIIFV3Collection;
        }
        
        setCollection(convertedData);
        
        // Extract items
        const itemList = convertedData.items || [];
        setItems(itemList);
        
        console.log("Loaded collection:", convertedData);
        console.log("Found items:", itemList);
      } catch (err) {
        console.error("Error loading collection:", err);
        setError(err instanceof Error ? err.message : t('CollectionPage.noCollection'));
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionUrl, t]);

  const getLabel = (label: string | { [key: string]: string[] } | undefined): string => {
    if (!label) return "";
    if (typeof label === "string") return label;
    
    // For v3 format: { "ja": ["ラベル"], "en": ["Label"] }
    if (typeof label === "object") {
      // Try to get current locale label first
      if (locale in label && Array.isArray(label[locale])) {
        return label[locale][0] || "";
      }
      // Try Japanese
      if ("ja" in label && Array.isArray(label.ja)) {
        return label.ja[0] || "";
      }
      // Fall back to first available language
      const firstLang = Object.keys(label)[0];
      if (firstLang && Array.isArray(label[firstLang])) {
        return label[firstLang][0] || "";
      }
    }
    
    return "";
  };

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
        query.set("u", collectionUrl);
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
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          {parentCollectionUrl ? t('CollectionPage.backToParent') : t('CollectionPage.backToHome')}
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-2">
        {collection ? getLabel(collection.label) : t('CollectionPage.title')}
      </h1>
      
      {collection?.summary && (
        <p className="text-gray-600 dark:text-gray-400 mb-6">
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
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {items.length} {t('CollectionPage.items')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
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
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {isCollection ? (
                        <Folder className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <FileText className="h-5 w-5 text-blue-600" />
                      )}
                      {getLabel(item.label)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {thumbnailUrl && (
                      <img 
                        src={thumbnailUrl} 
                        alt={getLabel(item.label)}
                        className="w-full h-48 object-cover rounded mb-2"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    {summary && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                        {summary}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
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
                
                return (
                  <div
                    key={index}
                    onClick={() => handleItemClick(item)}
                    className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 
                      border border-gray-200 dark:border-gray-700 rounded-lg
                      hover:shadow-md transition-shadow cursor-pointer"
                  >
                    {/* サムネイル */}
                    {thumbnailUrl && (
                      <img 
                        src={thumbnailUrl} 
                        alt={label}
                        className="w-16 h-16 object-cover rounded flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    
                    {/* コンテンツ */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {isCollection ? (
                              <Folder className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            )}
                            <span className="truncate">{label}</span>
                          </h3>
                          
                          {summary && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                              {summary}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                              {isCollection ? t('CollectionPage.typeCollection') : t('CollectionPage.typeManifest')}
                            </span>
                            <span className="truncate max-w-xs" title={item.id}>
                              {item.id}
                            </span>
                          </div>
                        </div>
                        
                        <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
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
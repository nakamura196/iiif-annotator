"use client";

import dynamic from "next/dynamic";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState, useCallback, useMemo } from "react";
import type {
  AnnotoriousOpenSeadragonAnnotator,
  ImageAnnotation,
} from "@annotorious/react";
import "@annotorious/react/annotorious-react.css";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from 'next-intl';
import FirestoreAnnotationAdapter from "@/lib/FirestoreAnnotationAdapter";
import { AnnotationList } from "@/components/annotation/AnnotationList";
import { AnnotationForm } from "@/components/annotation/AnnotationForm";
import { ToolBar } from "@/components/annotation/ToolBar";
import { Viewer } from "@/components/annotation/Viewer";
import { useAnnotator, useSelection } from "@annotorious/react";
import { auth } from "@/lib/firebase";
import {
  convertMultipleAnnotations,
  convertAnnotoriousToIIIF,
} from "@/lib/utils/annotationConverter";
import {
  Annotation,
  AnnotationWidthSingleBody,
  AnnotationWithMultipleBodies,
} from "@/types/annotation";
import { LoadingScreen } from "@/components/LoadingScreen";
import { convertPresentation2 } from "@iiif/parser/presentation-2";
import { Canvas } from "@iiif/presentation-3";
import { Export } from "@/components/export";
import { ManifestViewer } from "@/components/ManifestViewer";
import { OCRProcessor } from "@/components/OCRProcessor";
import { ScanText, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
// コンポーネントの動的インポート
const DynamicAnnotorious = dynamic(
  () => import("@annotorious/react").then((mod) => mod.Annotorious),
  { ssr: false }
);

function App() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const manifestUrl = searchParams.get("manifest");
  const t = useTranslations('Editor');

  const [infoUrls, setInfoUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tool, setTool] = useState<"rectangle" | "polygon" | undefined>();
  const [user, setUser] = useState<User | null>(null);
  const [adapter, setAdapter] = useState<FirestoreAnnotationAdapter | null>(
    null
  );

  const [currentPage, setCurrentPage] = useState(-1);
  const [canvases, setCanvases] = useState<Canvas[]>([]);

  const [results, setResults] = useState<Annotation[]>([]);

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);

  const [isManifestViewerOpen, setIsManifestViewerOpen] = useState(false);
  const [isOCROpen, setIsOCROpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>("");

  const anno = useAnnotator<AnnotoriousOpenSeadragonAnnotator>();

  const selection = useSelection();

  // ログイン状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  // マニフェストの取得とアダプターの初期化
  useEffect(() => {
    async function initialize() {
      try {
        const manifestUrl = searchParams.get("manifest");
        if (!manifestUrl) return;

        const response = await fetch(manifestUrl);
        let manifest = await response.json();

        const context = manifest["@context"];
        if (context && context.includes("presentation/2")) {
          manifest = convertPresentation2(manifest);
        }

        const canvases = manifest.items; // .sequences?.[0]?.canvases || [];
        setCanvases(canvases);

        const tileSources = canvases
          .map((canvas: Canvas) => {
            const annotationPage = canvas.items?.[0];
            const annotation = annotationPage?.items?.[0];
            if (!annotation) return null;
            const body = annotation.body as {
              id: string;
              service?: Array<{ "@id"?: string; id?: string; type?: string }>;
            };

            if (body.service && body.service.length > 0) {
              const serviceUrl = body.service[0]["@id"] || body.service[0].id;
              if (serviceUrl) {
                return serviceUrl + "/info.json";
              }
            }
            
            return {
              type: "image",
              url: body.id,
            };
          })
          .filter(
            (tileSource: string | { type: string; url: string } | null) =>
              tileSource !== null
          );

        setInfoUrls(tileSources);

        const pos = Number(searchParams.get("pos") || 1);
        const initialPage = Math.max(0, pos - 1);

        // setCanvasId(canvasId);
        setCurrentPage(initialPage);
      } catch {
        // Failed to initialize
      } finally {
        setIsLoading(false);
      }
    }

    initialize();
  }, [searchParams]);

  // main
  useEffect(() => {
    if (!anno) return;
    if (currentPage === -1) return;

    const canvasId = canvases[currentPage]?.["id"];

    // Get current image URL for OCR
    const canvas = canvases[currentPage];
    if (canvas) {
      const annotationPage = canvas.items?.[0];
      const annotation = annotationPage?.items?.[0];
      if (annotation) {
        const body = annotation.body as {
          id: string;
          service?: Array<{ "@id"?: string; id?: string; type?: string }>;
        };
        
        // Try to get the full quality image URL from service if available
        let imageUrl = body.id;
        if (body.service && body.service.length > 0) {
          const service = body.service[0];
          const serviceUrl = service["@id"] || service.id;
          if (serviceUrl) {
            // Check if it's Image API v3 by looking at the type or URL path
            const isV3 = service.type === "ImageService3" || serviceUrl.includes("/iiif/3/");
            // Get full resolution image from IIIF Image API
            // v3 uses "max" instead of "full" for size parameter
            imageUrl = isV3 
              ? `${serviceUrl}/full/max/0/default.jpg`
              : `${serviceUrl}/full/full/0/default.jpg`;
          }
        }
        setCurrentImageUrl(imageUrl);
      }
    }

    const newAdapter = new FirestoreAnnotationAdapter(canvasId, manifestUrl);
    setAdapter(newAdapter);

    const pageAdapter = new FirestoreAnnotationAdapter(canvasId, manifestUrl);

    pageAdapter.all().then((result) => {
      setResults(result.items as Annotation[]);

      // アノテーションを変換して設定
      try {
        const annotoriousAnnotations = convertMultipleAnnotations(
          result.items as AnnotationWidthSingleBody[]
        );

        if (annotoriousAnnotations.length > 0) {
          // Try setting annotations one by one to handle individual errors
          const validAnnotations: ImageAnnotation[] = [];
          const failedAnnotations: string[] = [];
          
          // First clear any existing annotations
          anno.clearAnnotations();
          
          // Try to add each annotation individually
          for (const annotation of annotoriousAnnotations) {
            try {
              anno.addAnnotation(annotation);
              validAnnotations.push(annotation);
            } catch {
              failedAnnotations.push(annotation.id);
              
              // Skip fallback - annotation ID already exists
              // Just log the failure
            }
          }
          
          // Track failed annotations silently
        }
      } catch {
        // Failed to set annotations
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno, currentPage, user]);

  // Update URL when page changes
  const updateURLWithPage = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pos', String(page + 1));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // ページ変更ハンドラーをメモ化
  const handlePageChange = useCallback(async (event: { page: number }) => {
    // 初期化
    setSelectedAnnotationId(null);

    setTool(undefined);
    const newPage = event.page;
    setCurrentPage(newPage);
    updateURLWithPage(newPage);
  }, [updateURLWithPage]);

  useEffect(() => {
    if (!anno) return;

    const viewer = anno.viewer;
    if (viewer) {
      viewer.addHandler("page", handlePageChange);
      return () => {
        viewer.removeHandler("page", handlePageChange);
      };
    }
  }, [anno, handlePageChange]); // handlePageChangeを依存配列に追加

  const handleDelete = async (ids: string[]) => {
    if (!adapter) return;

    try {
      for (const id of ids) {
        anno.removeAnnotation(id);

        const ex = results.find((r) => r.id === id);
        if (ex) {
          await adapter.delete(id);
        }
      }

      // Update results after deletion
      setResults((prevResults) =>
        prevResults.filter((r) => !ids.includes(r.id))
      );
    } catch {
      // Failed to delete annotation
    }

    setSelectedAnnotationId(null);
    // setSelectedAnnotation(null);
    setTool(undefined);
  };

  // アノテーション選択時の統一ハンドラー
  const handleSelect = useCallback((annotationId: string | undefined) => {
    if (annotationId) {
      setSelectedAnnotationId(annotationId);
    } else {
      setSelectedAnnotationId(null);
    }
  }, []);

  // Focus on annotation by navigating viewport
  const handleFocus = useCallback((annotationId: string) => {
    if (!anno) return;

    // First try to get from anno, then fallback to results
    let annotation = anno.getAnnotations().find((a) => a.id === annotationId);
    if (!annotation) {
      // If not found in anno, get from results
      annotation = results.find((r) => r.id === annotationId);
    }

    if (!annotation) {
      return;
    }

    // Handle both selector formats: single object or array
    const target = annotation.target as { selector?: { value?: string } | Array<{ value?: string; type?: string }> };
    let selectorValue: string | undefined;

    if (Array.isArray(target.selector)) {
      // Find the FragmentSelector or SvgSelector in the array
      const fragmentSelector = target.selector.find(
        (s) => s.type === 'FragmentSelector' || s.type === 'SvgSelector'
      );
      selectorValue = fragmentSelector?.value;
    } else if (target.selector) {
      selectorValue = target.selector.value;
    }

    if (!selectorValue) {
      return;
    }

    let x: number, y: number, w: number, h: number;

    // Parse xywh format: "xywh=pixel:x,y,w,h" or "xywh=x,y,w,h"
    const xywhMatch = selectorValue.match(/xywh=(?:pixel:)?([\d.]+),([\d.]+),([\d.]+),([\d.]+)/);
    if (xywhMatch) {
      [, x, y, w, h] = xywhMatch.map(Number);
    } else {
      // Parse SVG polygon format: <svg><polygon points="x1,y1 x2,y2 ..."/></svg>
      const polygonMatch = selectorValue.match(/points="([^"]+)"/);
      if (!polygonMatch) {
        return;
      }

      // Extract all coordinate pairs
      const points = polygonMatch[1].split(/[\s,]+/).map(Number);

      // Calculate bounding box
      const xCoords: number[] = [];
      const yCoords: number[] = [];
      for (let i = 0; i < points.length; i += 2) {
        xCoords.push(points[i]);
        yCoords.push(points[i + 1]);
      }

      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);

      x = minX;
      y = minY;
      w = maxX - minX;
      h = maxY - minY;
    }

    // Get image dimensions from OpenSeadragon
    const viewer = anno.viewer;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) {
      return;
    }

    // Dynamically import OpenSeadragon
    import('openseadragon').then((OSD) => {
      // Calculate center point of annotation in image coordinates
      const centerX = x + w / 2;
      const centerY = y + h / 2;

      // Create point in image coordinates
      const imagePoint = new OSD.default.Point(centerX, centerY);

      // Convert from image coordinates to viewport coordinates
      const viewportPoint = tiledImage.imageToViewportCoordinates(imagePoint);

      // Select the annotation first
      setSelectedAnnotationId(annotationId);

      // Pan to the center of annotation smoothly without zooming
      viewer.viewport.panTo(viewportPoint, false);
    }).catch((error) => {
      console.error('Failed to load OpenSeadragon:', error);
    });
  }, [anno, results]);

  const handleChange = async (text: string) => {
    const updatedAnnotation = anno
      ?.getAnnotations()
      .find((a) => a.id === selectedAnnotationId);

    if (!updatedAnnotation) return;

    (updatedAnnotation as unknown as AnnotationWithMultipleBodies).body = [
      { type: "TextualBody", value: text },
    ];

    anno?.updateAnnotation(updatedAnnotation as Partial<ImageAnnotation>);

    const ex = results.find((r) => r.id === updatedAnnotation.id) as Annotation;

    const canvasId = canvases[currentPage]?.["id"];
    const manifestUrl = searchParams.get("manifest") || "";

    const iiifAnnotation = convertAnnotoriousToIIIF(
      updatedAnnotation as unknown as ImageAnnotation,
      canvasId,
      manifestUrl
    );

    if (ex) {
      const updated = await adapter?.update(iiifAnnotation);
      if (updated) {
        setResults(updated.items as Annotation[]);
      }
    } else {
      const created = await adapter?.create(iiifAnnotation);
      if (created) {
        setResults(created.items as Annotation[]);
      }
    }

    setTool(undefined);
    setSelectedAnnotationId(null);
  };

  useEffect(() => {
    if (selection.selected.length > 0) {
      setSelectedAnnotationId(selection.selected[0].annotation.id);
    }
  }, [selection]);

  // Keyboard shortcut to focus text editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl+S (Windows/Linux) or Cmd+S (Mac) is pressed
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        // Only trigger if annotation is selected
        if (selectedAnnotationId) {
          e.preventDefault();
          // Trigger form submission
          const form = document.querySelector('form') as HTMLFormElement;
          if (form) {
            form.requestSubmit();
          }
        }
        return;
      }

      // Ignore if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Focus text editor when T is pressed and a tool is selected or annotation is selected
      if (key === 't' && (tool !== undefined || selectedAnnotationId)) {
        const editorElement = document.querySelector('.ck-editor__editable') as HTMLElement;
        if (editorElement) {
          editorElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tool, selectedAnnotationId]);

  useEffect(() => {
    if (!anno) return;

    if (selectedAnnotationId) {
      anno.setStyle((annotation) => {
        if (annotation.id === selectedAnnotationId) {
          return {
            fillOpacity: 0.0,
            stroke: "#FFFF00", // yellow
            strokeWidth: 2,
          };
        }
      });
      anno.setSelected(selectedAnnotationId);
    } else {
      // Clear Annotorious selection when selectedAnnotationId is null
      anno.cancelSelected();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnnotationId]);

  // Auto-focus text editor when new annotation is created
  useEffect(() => {
    if (!anno) return;

    const handleCreateAnnotation = () => {
      // Wait for DOM to update, then focus the editor
      setTimeout(() => {
        const editorElement = document.querySelector('.ck-editor__editable') as HTMLElement;
        if (editorElement) {
          editorElement.focus();
        }
      }, 100);
    };

    anno.on('createAnnotation', handleCreateAnnotation);

    return () => {
      anno.off('createAnnotation', handleCreateAnnotation);
    };
  }, [anno]);

  // Memoize viewer options before any conditional returns
  const viewerOptions = useMemo(() => ({
    prefixUrl:
      "https://cdn.jsdelivr.net/npm/openseadragon@latest/build/openseadragon/images/",
    tileSources: infoUrls,
    gestureSettingsMouse: {
      clickToZoom: false,
      dblClickToZoom: false,
    },
    sequenceMode: true,
    initialPage: currentPage,
  }), [infoUrls, currentPage]);

  // ローディング表示
  if (isLoading) {
    return <LoadingScreen message={t('loadingManifest')} />;
  }

  // infoUrls が空の場合
  if (infoUrls.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-screen 
        bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
      >
        {t('noImagesFound')}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col lg:flex-row h-[calc(100vh-8rem)]
      bg-white dark:bg-gray-900"
    >
      {/* サイドバー（アノテーションリスト） */}
      <div
        className="w-full lg:w-1/4 h-[50vh] lg:h-full
        border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700
        flex flex-col overflow-hidden"
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          {/* Header - Responsive layout */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            {/* Title and page info with navigation */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 flex-1">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1">
                  {t('page', { current: currentPage + 1, total: infoUrls.length })}
                </p>
              </div>
              {/* Page navigation buttons */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => {
                    if (anno && currentPage > 0) {
                      anno.viewer.goToPage(currentPage - 1);
                    }
                  }}
                  disabled={currentPage === 0}
                  className="p-1 sm:p-1.5 rounded text-gray-600 dark:text-gray-400 
                    hover:text-gray-900 dark:hover:text-gray-100 
                    disabled:opacity-50 disabled:cursor-not-allowed
                    hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button
                  onClick={() => {
                    if (anno && currentPage < infoUrls.length - 1) {
                      anno.viewer.goToPage(currentPage + 1);
                    }
                  }}
                  disabled={currentPage === infoUrls.length - 1}
                  className="p-1 sm:p-1.5 rounded text-gray-600 dark:text-gray-400 
                    hover:text-gray-900 dark:hover:text-gray-100 
                    disabled:opacity-50 disabled:cursor-not-allowed
                    hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <AnnotationList
          annotations={
            results as unknown as AnnotationWithMultipleBodies[]
          }
          onDelete={handleDelete}
          onSelect={handleSelect}
          onFocus={handleFocus}
          selectedId={selectedAnnotationId || undefined}
        />
      </div>

      {/* メインビューア */}
      <div className="w-full lg:w-2/4 min-h-[50vh] lg:min-h-full flex flex-col">
        <Viewer tool={tool} options={viewerOptions} />
      </div>

      {/* 右サイドバー（ツールバーとフォーム） */}
      <div
        className="w-full lg:w-1/4 border-t lg:border-t-0 lg:border-l
        border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col"
      >
        <ToolBar tool={tool} setTool={setTool} />
        <AnnotationForm
          id={selectedAnnotationId || ""}
          text={
            (
              anno?.getAnnotations() as unknown as AnnotationWithMultipleBodies[]
            )?.find((a) => a.id === selectedAnnotationId)?.body?.[0]?.value ||
            ""
          }
          onChange={handleChange}
          onDelete={handleDelete}
        />
        {/* Action buttons */}
        <div className="mt-auto p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsOCROpen(true)}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20
                text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30
                transition-colors"
              title="OCR Text Recognition"
            >
              <ScanText className="h-4 w-4" />
              <span className="hidden lg:inline">OCR</span>
            </button>
            <button
              onClick={() => setIsManifestViewerOpen(true)}
              className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900
                dark:hover:text-gray-100 transition-colors"
              title="View IIIF Manifest"
            >
              <Image
                src="/IIIF-logo-colored-text.svg"
                alt="IIIF"
                width={20}
                height={20}
                style={{ height: "auto" }}
                className="opacity-60 hover:opacity-100 transition-opacity"
              />
            </button>
            <Export adapter={adapter} />
          </div>
        </div>
      </div>
      
      {/* Manifest Viewer Modal */}
      {manifestUrl && (
        <ManifestViewer
          manifestUrl={manifestUrl}
          isOpen={isManifestViewerOpen}
          onClose={() => setIsManifestViewerOpen(false)}
        />
      )}
      
      {/* OCR Processor Modal */}
      {currentImageUrl && (
        <OCRProcessor
          imageUrl={currentImageUrl}
          isOpen={isOCROpen}
          onClose={() => setIsOCROpen(false)}
          canvasWidth={(() => {
            const canvas = canvases[currentPage];
            if (canvas?.width) return canvas.width;
            const annotationPage = canvas?.items?.[0];
            const annotation = annotationPage?.items?.[0];
            const body = annotation?.body as { width?: number; height?: number };
            return body?.width || 3026;
          })()}
          canvasHeight={(() => {
            const canvas = canvases[currentPage];
            if (canvas?.height) return canvas.height;
            const annotationPage = canvas?.items?.[0];
            const annotation = annotationPage?.items?.[0];
            const body = annotation?.body as { width?: number; height?: number };
            return body?.height || 4583;
          })()}
          onTextExtracted={async (_text, detections) => {
            // Check if user is logged in first
            if (!user) {
              alert("ログインが必要です");
              return;
            }
            
            // Create annotations from OCR results
            if (detections && detections.length > 0 && anno) {
              const newAnnotations = [];
              
              for (const detection of detections) {
                if (detection.box && detection.text) {
                  const [x, y, width, height] = detection.box;
                  
                  // Validate dimensions
                  if (width <= 0 || height <= 0 || isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
                    // Skip invalid dimensions
                    continue;
                  }
                  
                  // Create annotation in Annotorious format
                  const newAnnotation = {
                    id: `ocr-${Date.now()}-${Math.random()}`,
                    target: {
                      selector: {
                        type: "FragmentSelector",
                        conformsTo: "http://www.w3.org/TR/media-frags/",
                        value: `xywh=pixel:${Math.round(x)},${Math.round(y)},${Math.round(width)},${Math.round(height)}`
                      }
                    },
                    body: [
                      {
                        type: "TextualBody",
                        value: detection.text.trim(),
                        purpose: "commenting"
                      }
                    ]
                  };
                  
                  try {
                    // Add annotation to Annotorious
                    anno.addAnnotation(newAnnotation as unknown as ImageAnnotation);
                    newAnnotations.push(newAnnotation);
                  } catch {
                    // Skip if annotation cannot be added
                    continue;
                  }
                }
              }
              
              // Save all annotations to Firebase at once
              if (adapter && newAnnotations.length > 0) {
                try {
                  const canvasId = canvases[currentPage]?.["id"];
                  const iiifAnnotations = [];
                  
                  for (const annotation of newAnnotations) {
                    const iiifAnnotation = convertAnnotoriousToIIIF(
                      annotation as unknown as ImageAnnotation,
                      canvasId,
                      manifestUrl || ""
                    );
                    await adapter.create(iiifAnnotation);
                    iiifAnnotations.push(iiifAnnotation);
                  }
                  
                  setResults([...results, ...iiifAnnotations]);
                } catch {
                  // Handle error silently or show single error message
                  alert("アノテーションの保存に失敗しました");
                }
              }
            }
            // Don't close automatically - let user review results
          }}
        />
      )}
    </div>
  );
}

// クライアントサイドのみでレンダリングされるコンポーネント
const ClientOnly = dynamic(() => Promise.resolve(() => (
  <div className="h-full">
    <App />
  </div>
)), {
  ssr: false,
});

export default function OpenSeadragonExample() {
  return (
    <DynamicAnnotorious>
      <ClientOnly />
    </DynamicAnnotorious>
  );
}

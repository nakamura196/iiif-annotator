"use client";

import dynamic from "next/dynamic";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState, useCallback, useMemo } from "react";
import type {
  AnnotoriousOpenSeadragonAnnotator,
  ImageAnnotation,
} from "@annotorious/react";
import "@annotorious/react/annotorious-react.css";
import { useSearchParams } from "next/navigation";
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
import { ScanText } from "lucide-react";
import Image from "next/image";
// コンポーネントの動的インポート
const DynamicAnnotorious = dynamic(
  () => import("@annotorious/react").then((mod) => mod.Annotorious),
  { ssr: false }
);

function App() {
  const searchParams = useSearchParams();
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
      } catch (error) {
        console.error("Failed to initialize:", error);
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
      const annotoriousAnnotations = convertMultipleAnnotations(
        result.items as AnnotationWidthSingleBody[]
      );

      anno.setAnnotations(annotoriousAnnotations);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno, currentPage, user]);

  // ページ変更ハンドラーをメモ化
  const handlePageChange = useCallback(async (event: { page: number }) => {
    // 初期化
    setSelectedAnnotationId(null);

    setTool(undefined);
    const newPage = event.page;
    setCurrentPage(newPage);
  }, []);

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
    } catch (error) {
      console.error("Failed to delete annotation:", error);
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
      await adapter?.update(iiifAnnotation);
    } else {
      await adapter?.create(iiifAnnotation);
      setResults([...results, iiifAnnotation]);
    }

    setTool(undefined);
  };

  useEffect(() => {
    if (selection.selected.length > 0) {
      setSelectedAnnotationId(selection.selected[0].annotation.id);
    }
  }, [selection]);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAnnotationId]);

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
      className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-8rem)]
      bg-white dark:bg-gray-900"
    >
      {/* サイドバー（アノテーションリスト） */}
      <div
        className="w-full lg:w-1/4 border-b lg:border-b-0 lg:border-r 
        border-gray-200 dark:border-gray-700 flex flex-col"
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('annotations')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('page', { current: currentPage + 1, total: infoUrls.length })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsOCROpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 
                  text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 
                  transition-colors"
                title="OCR Text Recognition"
              >
                <ScanText className="h-4 w-4" />
                <span className="hidden sm:inline">OCR</span>
              </button>
              <button
                onClick={() => setIsManifestViewerOpen(true)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 
                  dark:hover:text-gray-100 transition-colors"
                title="View IIIF Manifest"
              >
                <Image 
                  src="/IIIF-logo-colored-text.svg" 
                  alt="IIIF" 
                  width={20} 
                  height={20}
                  className="opacity-60 hover:opacity-100 transition-opacity"
                />
              </button>
              <Export adapter={adapter} />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AnnotationList
            annotations={
              (anno?.getAnnotations() as unknown as AnnotationWithMultipleBodies[]) ||
              []
            }
            onDelete={handleDelete}
            onSelect={handleSelect}
            selectedId={selectedAnnotationId || undefined}
          />
        </div>
      </div>

      {/* メインビューア */}
      <div className="w-full lg:w-2/4 min-h-[50vh] lg:min-h-full flex flex-col">
        <Viewer tool={tool} options={viewerOptions} />
      </div>

      {/* 右サイドバー（ツールバーとフォーム） */}
      <div
        className="w-full lg:w-1/4 border-t lg:border-t-0 lg:border-l 
        border-gray-200 dark:border-gray-700 overflow-y-auto"
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
          onTextExtracted={async (text, detections) => {
            // Create annotations from OCR results
            if (detections && detections.length > 0 && anno) {
              for (const detection of detections) {
                if (detection.box && detection.text) {
                  const [x, y, width, height] = detection.box;
                  
                  // Create annotation in Annotorious format
                  const newAnnotation = {
                    id: `ocr-${Date.now()}-${Math.random()}`,
                    target: {
                      selector: {
                        type: "FragmentSelector",
                        conformsTo: "http://www.w3.org/TR/media-frags/",
                        value: `xywh=pixel:${x},${y},${width},${height}`
                      }
                    },
                    body: [
                      {
                        type: "TextualBody",
                        value: detection.text,
                        purpose: "commenting"
                      }
                    ]
                  };
                  
                  // Add annotation to Annotorious
                  anno.addAnnotation(newAnnotation as unknown as ImageAnnotation);
                  
                  // Save to Firebase
                  if (adapter) {
                    const canvasId = canvases[currentPage]?.["id"];
                    const iiifAnnotation = convertAnnotoriousToIIIF(
                      newAnnotation as unknown as ImageAnnotation,
                      canvasId,
                      manifestUrl || ""
                    );
                    await adapter.create(iiifAnnotation);
                    setResults([...results, iiifAnnotation]);
                  }
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

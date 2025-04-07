"use client";

import dynamic from "next/dynamic";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState, useCallback } from "react";
import type {
  AnnotoriousOpenSeadragonAnnotator,
  ImageAnnotation,
} from "@annotorious/react";
import "@annotorious/react/annotorious-react.css";
import { useSearchParams } from "next/navigation";
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
// コンポーネントの動的インポート
const DynamicAnnotorious = dynamic(
  () => import("@annotorious/react").then((mod) => mod.Annotorious),
  { ssr: false }
);

function App() {
  const searchParams = useSearchParams();
  const manifestUrl = searchParams.get("manifest");

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

        const urls = canvases.map((canvas: Canvas) => {
          const body = canvas.items?.[0]?.items?.[0]?.body as {
            service: { "@id": string }[];
          };
          const image = body?.service?.[0]?.["@id"];
          return `${image}/info.json`;
        });

        setInfoUrls(urls);

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

  // ローディング表示
  if (isLoading) {
    return <LoadingScreen message="Loading manifest..." />;
  }

  // infoUrls が空の場合
  if (infoUrls.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-screen 
        bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
      >
        No images found in manifest
      </div>
    );
  }

  const getViewerOptions = (infoUrls: string[]) => ({
    prefixUrl:
      "https://cdn.jsdelivr.net/npm/openseadragon@latest/build/openseadragon/images/",
    tileSources: infoUrls,
    gestureSettingsMouse: {
      clickToZoom: false,
      dblClickToZoom: false,
    },
    sequenceMode: true,
    initialPage: currentPage,
  });

  return (
    <div
      className="flex flex-col lg:flex-row flex-1 h-full 
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
                Annotations
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Page: {currentPage + 1} of {infoUrls.length}
              </p>
            </div>
            <Export adapter={adapter} />
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
      <div className="w-full lg:w-2/4 h-[50vh] lg:h-auto flex flex-col">
        <Viewer tool={tool} options={getViewerOptions(infoUrls)} />
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
    </div>
  );
}

// クライアントサイドのみでレンダリングされるコンポーネント
const ClientOnly = dynamic(() => Promise.resolve(App), {
  ssr: false,
});

export default function OpenSeadragonExample() {
  return (
    <DynamicAnnotorious>
      <ClientOnly />
    </DynamicAnnotorious>
  );
}

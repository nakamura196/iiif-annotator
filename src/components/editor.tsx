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
import { useTranslations, useLocale } from 'next-intl';
import { getIIIFLabel } from "@/lib/utils/iiifLabel";
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
  MetadataField,
} from "@/types/annotation";
import {
  getVocabularies,
  addPropertiesToVocabulary,
  type Vocabulary,
} from "@/lib/metadataVocabulary";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { LoadingScreen } from "@/components/LoadingScreen";
import { convertPresentation2 } from "@iiif/parser/presentation-2";
import { Canvas } from "@iiif/presentation-3";
import { Export } from "@/components/export";
import { ManifestViewer } from "@/components/ManifestViewer";
import { ScanText, ChevronLeft, ChevronRight, LayoutGrid, MessageSquareText } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { ThumbnailPanel } from "@/components/annotation/ThumbnailPanel";
import { SidebarThumbnails } from "@/components/annotation/SidebarThumbnails";
// コンポーネントの動的インポート
const DynamicAnnotorious = dynamic(
  () => import("@annotorious/react").then((mod) => mod.Annotorious),
  { ssr: false }
);

// OCRProcessor は onnxruntime-web(external 'ort') を読み込む OCR パッケージに
// 依存する。静的 import すると item ページ表示時に OCR チャンクが評価され、
// グローバル `ort` がまだ未定義のタイミングで参照して "ort is not defined" に
// なりうる。OCR モーダルを開くまで評価を遅延させて回避する。
const OCRProcessor = dynamic(
  () => import("@/components/OCRProcessor").then((mod) => mod.OCRProcessor),
  { ssr: false }
);

function App() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const manifestUrl = searchParams.get("manifest");
  const t = useTranslations('Editor');
  const locale = useLocale();

  const [infoUrls, setInfoUrls] = useState<string[]>([]);
  const [manifestLabel, setManifestLabel] = useState<string>("");
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

  // ユーザ単位のメタデータ語彙（複数の名前付きプロパティ集合）と、
  // 編集中に手動選択している語彙 ID。
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [selectedVocabId, setSelectedVocabId] = useState<string>("");

  // メンテナンス（作業停止）状態。有効中は保存が 503 で弾かれるため、上部にバナーを出す。
  // 1 分ごとに再取得し、移行完了で解除された後はリロード不要でバナーが消える。
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message?: string }>({
    enabled: false,
  });
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/system/maintenance")
        .then((r) => r.json())
        .then((s) => {
          if (!cancelled) setMaintenance(s);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 120000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  const [isManifestViewerOpen, setIsManifestViewerOpen] = useState(false);
  const [isOCROpen, setIsOCROpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>("");
  const [sidebarTab, setSidebarTab] = useState<"annotations" | "thumbnails">("annotations");

  // lg 以上でだけ 3 カラムをリサイズ可能にする（未満はモバイル縦積み）。
  // App は dynamic(ssr:false) のためハイドレーション不整合は起きない。
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const anno = useAnnotator<AnnotoriousOpenSeadragonAnnotator>();

  const selection = useSelection();

  // ログイン状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  // ユーザのメタデータ語彙を読み込む
  useEffect(() => {
    if (!user) {
      setVocabularies([]);
      return;
    }
    getVocabularies(user.uid)
      .then((v) => {
        setVocabularies(v);
        // 未選択なら先頭の語彙を既定で選ぶ
        setSelectedVocabId((cur) => (cur && v.some((x) => x.id === cur) ? cur : v[0]?.id || ""));
      })
      .catch(() => setVocabularies([]));
  }, [user]);

  // 選択中の語彙のプロパティ（入力フォームの候補）
  const activeProperties =
    vocabularies.find((v) => v.id === selectedVocabId)?.properties || [];

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

        setManifestLabel(getIIIFLabel(manifest.label, locale));

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

        const canvasParam = searchParams.get("canvas");
        let initialPage = 0;
        if (canvasParam) {
          const canvasIndex = canvases.findIndex(
            (c: Canvas) => c.id === canvasParam
          );
          initialPage = canvasIndex >= 0 ? canvasIndex : 0;
        } else {
          const pos = Number(searchParams.get("pos") || 1);
          initialPage = Math.max(0, pos - 1);
        }

        setCurrentPage(initialPage);
      } catch {
        // Failed to initialize
      } finally {
        setIsLoading(false);
      }
    }

    initialize();
  }, [searchParams, locale]);

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

        // 常に前ページのオーバーレイを消してから追加する。0 件の canvas に移った時に
        // clear をスキップすると前ページの図形が残り、それを編集すると別 canvas に誤複製される。
        anno.clearAnnotations();

        // Try to add each annotation individually（個別失敗はスキップ）
        for (const annotation of annotoriousAnnotations) {
          try {
            anno.addAnnotation(annotation);
          } catch {
            // Skip fallback - annotation ID already exists
          }
        }
      } catch {
        // Failed to set annotations
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno, currentPage, user]);

  // items を Annotorious キャンバスへ反映（clear して再追加）。
  // 常にサーバ（API）が返す正規の id を持つ items を描画するための共通処理。
  const renderItemsToCanvas = useCallback(
    (items: Annotation[]) => {
      if (!anno) return;
      try {
        const converted = convertMultipleAnnotations(items as AnnotationWidthSingleBody[]);
        anno.clearAnnotations();
        for (const a of converted) {
          try {
            anno.addAnnotation(a);
          } catch {
            /* 個別の追加失敗はスキップ */
          }
        }
      } catch {
        /* noop */
      }
    },
    [anno]
  );

  // サーバから再取得して results と canvas を同期する。作成/更新/削除の後に必ず呼ぶ。
  // これにより Annotorious 側の一時 id がサーバの doc id に揃い、続く編集/削除が
  // 正しいドキュメントを指す（旧実装の id 不整合バグの根本対策）。
  const reloadAnnotations = useCallback(async () => {
    if (!adapter) return;
    const result = await adapter.all();
    setResults(result.items as Annotation[]);
    renderItemsToCanvas(result.items as Annotation[]);
  }, [adapter, renderItemsToCanvas]);

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
    if (ids.length === 0) return;

    // 削除は永続（取り消し不可）なので確認を取る
    const message =
      ids.length === 1
        ? "このアノテーションを削除します。よろしいですか？"
        : `選択した ${ids.length} 件のアノテーションを削除します。よろしいですか？`;
    if (!window.confirm(message)) return;

    try {
      for (const id of ids) {
        const ex = results.find((r) => r.id === id);
        if (ex) {
          await adapter.delete(id);
        }
      }
      // サーバの状態で results / canvas を再同期（削除済みは返らない）
      await reloadAnnotations();
      toast.success(ids.length === 1 ? "アノテーションを削除しました" : `${ids.length} 件削除しました`);
    } catch (e) {
      // 失敗は握り潰さずユーザーに通知し、サーバの正で UI を復元する
      toast.error(`削除に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      await reloadAnnotations();
    }

    setSelectedAnnotationId(null);
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
    let annotation: ImageAnnotation | undefined = anno.getAnnotations().find((a) => a.id === annotationId);
    if (!annotation) {
      // If not found in anno, get from results
      const resultAnnotation = results.find((r) => r.id === annotationId);
      if (resultAnnotation) {
        // Convert Annotation to ImageAnnotation format
        annotation = resultAnnotation as unknown as ImageAnnotation;
      }
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

  const handleChange = async (text: string, metadata: MetadataField[] = []) => {
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
      manifestUrl,
      metadata
    );

    // 新しく使われた項目名は、選択中の語彙に追記（候補として再利用できるように）。
    // 語彙が未選択（1つも無い）場合は追記しない。
    if (user && selectedVocabId) {
      const newLabels = metadata
        .map((m) => m.label?.trim())
        .filter((l): l is string => !!l && !activeProperties.includes(l));
      if (newLabels.length > 0) {
        addPropertiesToVocabulary(user.uid, selectedVocabId, newLabels)
          .then(setVocabularies)
          .catch(() => {});
      }
    }

    try {
      if (ex) {
        await adapter?.update(iiifAnnotation);
      } else {
        await adapter?.create(iiifAnnotation);
      }
      // 作成後はサーバ採番の id に揃える必要があるため、必ず再取得して同期する
      await reloadAnnotations();
      toast.success(ex ? "アノテーションを更新しました" : "アノテーションを追加しました");
    } catch (e) {
      toast.error(`保存に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      await reloadAnnotations();
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

      // Ignore if user is typing in an input/textarea/contenteditable
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
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
      "https://cdn.jsdelivr.net/npm/openseadragon@5.0.1/build/openseadragon/images/",
    tileSources: infoUrls,
    drawer: "canvas",
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
        className="flex items-center justify-center h-[calc(100vh-4rem)]
        bg-[var(--ds-bg)] text-[var(--ds-fg)]"
      >
        {t('noImagesFound')}
      </div>
    );
  }

  // 3 カラムの中身（幅・境界は外側のレイアウトが持つ）。
  const leftContent = (
    <div className="h-full flex flex-col overflow-hidden">
        {manifestLabel && (
          <div className="px-3 py-2 border-b border-[var(--ds-border)] flex-shrink-0">
            <p
              className="text-sm font-medium text-[var(--ds-fg)] truncate"
              title={manifestLabel}
            >
              {manifestLabel}
            </p>
          </div>
        )}
        <div className="border-b border-[var(--ds-border)] flex-shrink-0">
          {/* Tab switcher + page navigation */}
          <div className="flex items-center justify-between px-2 pt-2">
            {/* Tabs */}
            <div className="flex gap-1">
              <button
                onClick={() => setSidebarTab("annotations")}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-t transition-colors
                  ${sidebarTab === "annotations"
                    ? "bg-[var(--ds-bg)] text-[var(--ds-primary)] border border-b-0 border-[var(--ds-border)] font-medium"
                    : "text-[var(--ds-fg-muted)] hover:text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)]"
                  }`}
                title={t('annotations')}
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('annotations')}</span>
              </button>
              <button
                onClick={() => setSidebarTab("thumbnails")}
                className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-t transition-colors
                  ${sidebarTab === "thumbnails"
                    ? "bg-[var(--ds-bg)] text-[var(--ds-primary)] border border-b-0 border-[var(--ds-border)] font-medium"
                    : "text-[var(--ds-fg-muted)] hover:text-[var(--ds-fg)] hover:bg-[var(--ds-surface-2)]"
                  }`}
                title={t('thumbnails')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('thumbnails')}</span>
              </button>
            </div>
            {/* Page info + navigation */}
            <div className="flex items-center gap-1">
              <p className="text-xs text-[var(--ds-fg-muted)]">
                {t('page', { current: currentPage + 1, total: infoUrls.length })}
              </p>
              <button
                onClick={() => {
                  if (anno && currentPage > 0) {
                    anno.viewer.goToPage(currentPage - 1);
                  }
                }}
                disabled={currentPage === 0}
                className="p-1 rounded text-[var(--ds-fg-muted)]
                  hover:text-[var(--ds-fg)]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  hover:bg-[var(--ds-surface-2)] transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (anno && currentPage < infoUrls.length - 1) {
                    anno.viewer.goToPage(currentPage + 1);
                  }
                }}
                disabled={currentPage === infoUrls.length - 1}
                className="p-1 rounded text-[var(--ds-fg-muted)]
                  hover:text-[var(--ds-fg)]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  hover:bg-[var(--ds-surface-2)] transition-colors"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {/* Tab content */}
        {sidebarTab === "annotations" ? (
          <AnnotationList
            annotations={
              results as unknown as AnnotationWithMultipleBodies[]
            }
            onDelete={handleDelete}
            onSelect={handleSelect}
            onFocus={handleFocus}
            selectedId={selectedAnnotationId || undefined}
          />
        ) : (
          <SidebarThumbnails
            canvases={canvases}
            currentPage={currentPage}
            onPageChange={(page) => {
              if (anno) {
                anno.viewer.goToPage(page);
              }
            }}
          />
        )}
    </div>
  );

  const centerContent = (
    <div className="h-full min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col">
          <Viewer tool={tool} options={viewerOptions} />
        </div>
        <ThumbnailPanel
          canvases={canvases}
          currentPage={currentPage}
          onPageChange={(page) => {
            if (anno) {
              anno.viewer.goToPage(page);
            }
          }}
        />
    </div>
  );

  const rightContent = (
    <div className="h-full overflow-y-auto flex flex-col">
        <ToolBar tool={tool} setTool={setTool} />
        <AnnotationForm
          id={selectedAnnotationId || ""}
          text={
            (
              anno?.getAnnotations() as unknown as AnnotationWithMultipleBodies[]
            )?.find((a) => a.id === selectedAnnotationId)?.body?.[0]?.value ||
            ""
          }
          metadata={
            results.find((r) => r.id === selectedAnnotationId)?.metadata || []
          }
          vocabulary={activeProperties}
          vocabularies={vocabularies.map((v) => ({ id: v.id, name: v.name }))}
          selectedVocabId={selectedVocabId}
          onSelectVocab={setSelectedVocabId}
          onChange={handleChange}
          onDelete={handleDelete}
        />
        {/* Action buttons */}
        <div className="mt-auto p-3 sm:p-4 border-t border-[var(--ds-border)]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsOCROpen(true)}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm rounded
                bg-[var(--ds-surface-2)] text-[var(--ds-primary)]
                hover:bg-[var(--ds-surface)] transition-colors"
              title="OCR Text Recognition"
            >
              <ScanText className="h-4 w-4" />
              <span className="hidden lg:inline">OCR</span>
            </button>
            <button
              onClick={() => setIsManifestViewerOpen(true)}
              className="p-1.5 sm:p-2 text-[var(--ds-fg-muted)] hover:text-[var(--ds-fg)] transition-colors"
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
  );

  return (
    <>
      {maintenance.enabled && (
        <div
          role="alert"
          className="fixed top-16 inset-x-0 z-40 px-4 py-2 text-sm text-center
            bg-amber-100 text-amber-900 border-b border-amber-300
            dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700"
        >
          {maintenance.message ||
            "ただいまメンテナンス（データ移行）のため、一時的に保存できません。しばらくお待ちください。"}
        </div>
      )}
      {isDesktop ? (
        // PanelGroup は inline で height:100% を当てるため、親に「定値の高さ」が必要。
        // ヘッダーは h-16(4rem) + border-b(1px) = 65px 占めるので、その分を引く。
        // （-1px を入れないと合計が 100vh を 1px 超え、縦スクロールバーが出る）
        <div className="h-[calc(100vh-4rem-1px)] bg-[var(--ds-bg)]">
        <PanelGroup direction="horizontal" autoSaveId="editor-columns">
          <Panel defaultSize={25} minSize={15} className="border-r border-[var(--ds-border)]">
            {leftContent}
          </Panel>
          <PanelResizeHandle
            className="w-1 bg-[var(--ds-border)] hover:bg-[var(--ds-primary)]
              data-[resize-handle-state=drag]:bg-[var(--ds-primary)] transition-colors cursor-col-resize"
          />
          <Panel defaultSize={50} minSize={25}>
            {centerContent}
          </Panel>
          <PanelResizeHandle
            className="w-1 bg-[var(--ds-border)] hover:bg-[var(--ds-primary)]
              data-[resize-handle-state=drag]:bg-[var(--ds-primary)] transition-colors cursor-col-resize"
          />
          <Panel defaultSize={25} minSize={15} className="border-l border-[var(--ds-border)]">
            {rightContent}
          </Panel>
        </PanelGroup>
        </div>
      ) : (
        // モバイルは縦積み。固定高の各カラム＋フォームで、はみ出し分は自然にスクロール。
        <div className="flex flex-col bg-[var(--ds-bg)]">
          <div className="h-[50vh] border-b border-[var(--ds-border)]">{leftContent}</div>
          <div className="h-[55vh] border-b border-[var(--ds-border)]">{centerContent}</div>
          <div className="border-t border-[var(--ds-border)]">{rightContent}</div>
        </div>
      )}

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

                  for (const annotation of newAnnotations) {
                    const iiifAnnotation = convertAnnotoriousToIIIF(
                      annotation as unknown as ImageAnnotation,
                      canvasId,
                      manifestUrl || ""
                    );
                    await adapter.create(iiifAnnotation);
                  }

                  // サーバ採番の id に揃えるため再取得して同期
                  await reloadAnnotations();
                  toast.success(`${newAnnotations.length} 件のアノテーションを追加しました`);
                } catch {
                  toast.error("アノテーションの保存に失敗しました");
                }
              }
            }
            // Don't close automatically - let user review results
          }}
        />
      )}
    </>
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

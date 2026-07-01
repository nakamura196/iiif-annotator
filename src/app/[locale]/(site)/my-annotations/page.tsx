"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { getIIIFLabel } from "@/lib/utils/iiifLabel";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Search,
  Calendar,
  FileText,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Image as ImageIcon,
} from "lucide-react";
import { type User } from "firebase/auth";

interface CanvasSummary {
  canvasId: string;
  count: number;
}
interface ManifestSummary {
  manifestId: string;
  total: number;
  canvases: CanvasSummary[];
}

interface AnnotationBody {
  value?: string;
  [key: string]: unknown;
}
interface Annotation {
  id: string;
  manifestId: string;
  canvasId: string;
  created: Date;
  modified: Date;
  target: unknown;
  body: AnnotationBody | AnnotationBody[];
}

type View = "manifests" | "canvases" | "annotations";

// canvasId(URL) を短く表示する。
function shortCanvas(id: string): string {
  try {
    const u = new URL(id);
    const segs = u.pathname.split("/").filter(Boolean);
    return segs.slice(-2).join("/") || id;
  } catch {
    return id;
  }
}

export default function MyAnnotationsPage() {
  const t = useTranslations("MyAnnotations");
  const locale = useLocale();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<ManifestSummary[]>([]);
  const [manifestLabels, setManifestLabels] = useState<Record<string, string>>({});

  const [view, setView] = useState<View>("manifests");
  const [selManifest, setSelManifest] = useState<ManifestSummary | null>(null);
  const [selCanvas, setSelCanvas] = useState<string | null>(null);
  const [canvasLabels, setCanvasLabels] = useState<Record<string, string>>({});

  const [canvasAnnos, setCanvasAnnos] = useState<Annotation[]>([]);
  const [annoLoading, setAnnoLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 概要（manifest×canvas の件数だけ）を取得する。read はシャード数だけで payload は極小。
  const loadSummary = async (currentUser: User) => {
    try {
      setLoading(true);
      setError(null);
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/annotations?summary=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`load failed (${res.status})`);
      const data = await res.json();
      setSummary((data.manifests || []) as ManifestSummary[]);
    } catch (err) {
      console.error("Error loading summary:", err);
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) await loadSummary(currentUser);
      else setLoading(false);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // manifest ラベルをまとめて取得。
  useEffect(() => {
    const ids = summary.map((m) => m.manifestId).filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ids.map(async (id): Promise<[string, string]> => {
          try {
            const res = await fetch(id);
            const manifest = await res.json();
            return [id, getIIIFLabel(manifest.label, locale)];
          } catch {
            return [id, ""];
          }
        })
      );
      if (!cancelled) setManifestLabels(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [summary, locale]);

  // manifest を開く → canvas 一覧へ。canvas ラベルもマニフェストから取得（v2/v3両対応）。
  const openManifest = async (m: ManifestSummary) => {
    setSelManifest(m);
    setView("canvases");
    setCanvasLabels({});
    try {
      const res = await fetch(m.manifestId);
      const manifest = await res.json();
      const canvases = manifest.items || manifest.sequences?.[0]?.canvases || [];
      const map: Record<string, string> = {};
      for (const c of canvases) {
        const cid = c.id || c["@id"];
        if (cid) map[cid] = getIIIFLabel(c.label, locale);
      }
      setCanvasLabels(map);
    } catch {
      /* ラベルは任意。失敗時は canvasId を短縮表示 */
    }
  };

  // canvas を開く → その canvas のアノテーションを取得（canvas スコープ = 1〜数 read）。
  const openCanvas = async (m: ManifestSummary, canvasId: string) => {
    setSelCanvas(canvasId);
    setView("annotations");
    setSearchQuery("");
    setCanvasAnnos([]);
    if (!user) return;
    try {
      setAnnoLoading(true);
      const token = await user.getIdToken();
      const url =
        `/api/annotations?manifestIds=${encodeURIComponent(m.manifestId)}` +
        `&canvasId=${encodeURIComponent(canvasId)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`load failed (${res.status})`);
      const data = await res.json();
      const group = (data.annotations || []).find(
        (g: { manifestId: string }) => g.manifestId === m.manifestId
      );
      const items = ((group?.items || []) as Array<
        { created?: string; modified?: string } & Record<string, unknown>
      >).map((it) => ({
        ...it,
        created: it.created ? new Date(it.created) : new Date(0),
        modified: it.modified ? new Date(it.modified) : new Date(0),
      })) as Annotation[];
      items.sort((a, b) => b.modified.getTime() - a.modified.getTime());
      setCanvasAnnos(items);
    } catch (err) {
      console.error("Error loading canvas annotations:", err);
      setError(t("loadError"));
    } finally {
      setAnnoLoading(false);
    }
  };

  const getAnnotationText = (a: Annotation): string => {
    if (!a.body) return "";
    if (Array.isArray(a.body)) return a.body.map((b) => b.value || "").join(" ");
    return a.body.value || "";
  };

  const formatDate = (d: Date): string =>
    d instanceof Date && d.getTime() > 0
      ? d.toLocaleDateString() + " " + d.toLocaleTimeString()
      : "";

  const getItemLink = (manifestId: string, canvasId: string) => {
    const params = new URLSearchParams({ manifest: manifestId, canvas: canvasId });
    return `/item?${params.toString()}`;
  };

  const manifestLabel = (id: string) => manifestLabels[id] || id;
  const totalAnnotations = summary.reduce((s, m) => s + m.total, 0);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[var(--ds-primary)]" />
          <p className="text-[var(--ds-fg-muted)]">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertDescription>{t("loginRequired")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // パンくず
  const breadcrumb = (
    <nav className="flex items-center flex-wrap gap-1 text-sm mb-6 text-[var(--ds-fg-muted)]">
      <button
        onClick={() => {
          setView("manifests");
          setSelManifest(null);
          setSelCanvas(null);
        }}
        className={`hover:text-[var(--ds-fg)] ${view === "manifests" ? "text-[var(--ds-fg)] font-medium" : ""}`}
      >
        {t("manifests")}
      </button>
      {selManifest && (
        <>
          <ChevronRight className="h-4 w-4" />
          <button
            onClick={() => {
              setView("canvases");
              setSelCanvas(null);
            }}
            className={`hover:text-[var(--ds-fg)] truncate max-w-[16rem] ${view === "canvases" ? "text-[var(--ds-fg)] font-medium" : ""}`}
            title={manifestLabel(selManifest.manifestId)}
          >
            {manifestLabel(selManifest.manifestId)}
          </button>
        </>
      )}
      {selManifest && selCanvas && view === "annotations" && (
        <>
          <ChevronRight className="h-4 w-4" />
          <span className="text-[var(--ds-fg)] font-medium truncate max-w-[12rem]" title={selCanvas}>
            {canvasLabels[selCanvas] || shortCanvas(selCanvas)}
          </span>
        </>
      )}
    </nav>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-[var(--ds-fg)]">{t("title")}</h1>
        <p className="text-[var(--ds-fg-muted)]">
          {t("description", { count: totalAnnotations })}
        </p>
      </div>

      {breadcrumb}

      {/* ---- Level 1: manifests ---- */}
      {view === "manifests" &&
        (summary.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-[var(--ds-fg-muted)]" />
            <p className="text-[var(--ds-fg-muted)]">{t("noAnnotations")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {summary.map((m) => (
              <button key={m.manifestId} onClick={() => openManifest(m)} className="block w-full text-left">
                <Card className="hover:shadow-lg transition-shadow">
                  <CardContent className="px-5 py-4 flex items-center gap-4">
                    <BookOpen className="h-5 w-5 text-[var(--ds-primary)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--ds-fg)] truncate" title={manifestLabel(m.manifestId)}>
                        {manifestLabel(m.manifestId)}
                      </p>
                      <p className="text-sm text-[var(--ds-fg-muted)]">
                        {t("annotationCount", { count: m.total })} ・ {t("canvasCount", { count: m.canvases.length })}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[var(--ds-fg-muted)] flex-shrink-0" />
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        ))}

      {/* ---- Level 2: canvases ---- */}
      {view === "canvases" && selManifest && (
        <div className="space-y-3">
          {[...selManifest.canvases]
            .sort((a, b) => b.count - a.count)
            .map((c) => (
              <button key={c.canvasId} onClick={() => openCanvas(selManifest, c.canvasId)} className="block w-full text-left">
                <Card className="hover:shadow-lg transition-shadow">
                  <CardContent className="px-5 py-4 flex items-center gap-4">
                    <ImageIcon className="h-5 w-5 text-[var(--ds-primary)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--ds-fg)] truncate" title={c.canvasId}>
                        {canvasLabels[c.canvasId] || shortCanvas(c.canvasId)}
                      </p>
                      <p className="text-sm text-[var(--ds-fg-muted)]">
                        {t("annotationCount", { count: c.count })}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[var(--ds-fg-muted)] flex-shrink-0" />
                  </CardContent>
                </Card>
              </button>
            ))}
        </div>
      )}

      {/* ---- Level 3: annotations ---- */}
      {view === "annotations" && selManifest && selCanvas && (
        <>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--ds-fg-muted)]" />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[var(--ds-border)] rounded-md
                  bg-[var(--ds-bg)] text-[var(--ds-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]"
              />
            </div>
            <Link
              href={getItemLink(selManifest.manifestId, selCanvas)}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md
                bg-[var(--ds-primary)] text-white hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <ExternalLink className="h-4 w-4" />
              {t("openInEditor")}
            </Link>
          </div>

          {annoLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--ds-primary)]" />
            </div>
          ) : (
            (() => {
              const q = searchQuery.trim().toLowerCase();
              const filtered = q
                ? canvasAnnos.filter((a) => getAnnotationText(a).toLowerCase().includes(q))
                : canvasAnnos;
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-[var(--ds-fg-muted)]" />
                    <p className="text-[var(--ds-fg-muted)]">
                      {q ? t("noSearchResults") : t("noAnnotations")}
                    </p>
                  </div>
                );
              }
              return (
                <div className="space-y-4">
                  {filtered.map((a) => (
                    <Link key={a.id} href={getItemLink(a.manifestId, a.canvasId)} className="block">
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardContent className="px-6 pt-5 pb-6">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <p className="font-medium text-[var(--ds-fg)] line-clamp-2 flex-1">
                              {getAnnotationText(a) || t("noText")}
                            </p>
                            <ExternalLink className="h-4 w-4 text-[var(--ds-fg-muted)] flex-shrink-0 mt-0.5" />
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[var(--ds-fg-muted)]">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span>{formatDate(a.modified)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              );
            })()
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { getIIIFLabel } from "@/lib/utils/iiifLabel";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Search, Calendar, FileText, ExternalLink } from "lucide-react";
import { type User } from "firebase/auth";

interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

interface AnnotationBody {
  value?: string;
  [key: string]: unknown;
}

interface Annotation {
  id: string;
  userId: string;
  userName?: string;
  manifestId: string;
  canvasId: string;
  created: FirestoreTimestamp | Date;
  modified: FirestoreTimestamp | Date;
  target: unknown;
  body: AnnotationBody | AnnotationBody[];
}

export default function MyAnnotationsPage() {
  const t = useTranslations("MyAnnotations");
  const locale = useLocale();
  const [user, setUser] = useState<User | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  // manifestId(URL) → 表示用ラベルのキャッシュ。
  // アノテーションには manifestId(URL) しか保存されていないため、
  // ユニークなマニフェストを 1 回ずつ取得して label を解決する。
  const [manifestLabels, setManifestLabels] = useState<Record<string, string>>({});
  const [filteredAnnotations, setFilteredAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // アノテーションは API 経由で取得する（書き込みと同じ API ファースト経路）。
  // サーバは新モデル annotationPages を userId で引き、シャードの items を平坦化して返すため、
  // read はシャード数だけ（旧来のクライアント直読み＝1件1read で全件、より桁違いに軽い）。
  const loadAnnotations = async (currentUser: User) => {
    try {
      setLoading(true);
      setError(null);

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/annotations?mine=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`load failed (${res.status})`);
      }
      const data = await res.json();
      // created/modified は ISO 文字列で返るので Date に正規化する。
      const loaded: Annotation[] = (data.items || []).map(
        (it: { created?: string; modified?: string } & Record<string, unknown>) => ({
          ...it,
          created: it.created ? new Date(it.created) : new Date(0),
          modified: it.modified ? new Date(it.modified) : new Date(0),
        })
      ) as Annotation[];

      loaded.sort((a, b) => {
        const at = a.modified instanceof Date ? a.modified.getTime() : 0;
        const bt = b.modified instanceof Date ? b.modified.getTime() : 0;
        return bt - at; // 新しい順
      });

      setAnnotations(loaded);
      setFilteredAnnotations(loaded);
    } catch (err) {
      console.error("Error loading annotations:", err);
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadAnnotations(currentUser);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ユニークな manifestId のラベルをまとめて取得する。
  useEffect(() => {
    const ids = Array.from(
      new Set(annotations.map((a) => a.manifestId).filter(Boolean))
    );
    if (ids.length === 0) return;

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ids.map(async (id): Promise<[string, string]> => {
          try {
            const res = await fetch(id);
            const manifest = await res.json();
            // v2/v3 どちらの label でも getIIIFLabel が解決する
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
  }, [annotations, locale]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredAnnotations(annotations);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = annotations.filter((annotation) => {
        const bodyText = getAnnotationText(annotation);
        return bodyText.toLowerCase().includes(query);
      });
      setFilteredAnnotations(filtered);
    }
  }, [searchQuery, annotations]);


  const getAnnotationText = (annotation: Annotation): string => {
    if (!annotation.body) return "";

    if (Array.isArray(annotation.body)) {
      return annotation.body
        .map((b) => b.value || "")
        .join(" ");
    }

    return annotation.body.value || "";
  };

  const formatDate = (timestamp: FirestoreTimestamp | Date): string => {
    if (!timestamp) return "";

    let date: Date;
    if ('seconds' in timestamp) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return "";
    }

    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };


  const getItemLink = (annotation: Annotation) => {
    // Create link to the item page with the manifest and canvas
    const params = new URLSearchParams({
      manifest: annotation.manifestId,
      canvas: annotation.canvasId,
    });
    return `/item?${params.toString()}`;
  };

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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-[var(--ds-fg)]">
          {t("title")}
        </h1>
        <p className="text-[var(--ds-fg-muted)]">
          {t("description", { count: annotations.length })}
        </p>
      </div>

      {/* Search Box */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[var(--ds-fg-muted)]" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[var(--ds-border)]
              rounded-md bg-[var(--ds-bg)] text-[var(--ds-fg)]
              focus:outline-none focus:ring-2 focus:ring-[var(--ds-ring)]"
          />
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-[var(--ds-fg-muted)]">
            {t("searchResults", { count: filteredAnnotations.length })}
          </p>
        )}
      </div>

      {/* Annotations List */}
      {filteredAnnotations.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto mb-4 text-[var(--ds-fg-muted)]" />
          <p className="text-[var(--ds-fg-muted)]">
            {searchQuery ? t("noSearchResults") : t("noAnnotations")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnotations.map((annotation) => {
            const text = getAnnotationText(annotation);

            return (
              <Link
                key={annotation.id}
                href={getItemLink(annotation)}
                className="block"
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardContent className="px-6 pt-5 pb-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <p className="font-medium text-[var(--ds-fg)] line-clamp-2 flex-1">
                        {text || t("noText")}
                      </p>
                      <ExternalLink className="h-4 w-4 text-[var(--ds-fg-muted)] flex-shrink-0 mt-0.5" />
                    </div>

                    <div className="space-y-2 text-sm text-[var(--ds-fg-muted)]">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>{formatDate(annotation.modified)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate" title={annotation.manifestId}>
                          {manifestLabels[annotation.manifestId] || annotation.manifestId}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

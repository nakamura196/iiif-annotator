"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { User } from "firebase/auth";
import {
  Loader2,
  Plus,
  Trash2,
  Tags,
  Check,
  Download,
  Upload,
} from "lucide-react";
import { buttonClass } from "@nakamura196/react-ui";
import { Card, CardContent } from "@/components/ui/card";
import {
  getVocabularies,
  saveVocabularies,
  normalizeVocabularies,
  type Vocabulary,
} from "@/lib/metadataVocabulary";
import { genId } from "@/lib/metadataVocabulary.helpers";

interface Props {
  user: User | null;
}

/**
 * ユーザ単位のメタデータ語彙を管理する。語彙は「名前付きのプロパティ集合」
 * （≒ Omeka S のリソーステンプレート）で、複数持てる。ここで登録した語彙を
 * アノテーション編集時に選ぶと、そのプロパティが入力候補として提示される。
 * JSON で Export / Import でき、複数人で共有できる。
 */
export default function MetadataVocabularySettings({ user }: Props) {
  const t = useTranslations("MetadataVocab");
  const [vocabs, setVocabs] = useState<Vocabulary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [importError, setImportError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    getVocabularies(user.uid)
      .then((v) => {
        if (active) setVocabs(v);
      })
      .catch((err) => console.error("Failed to load vocabulary:", err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const dirty = () => {
    setSaved(false);
    setImportError(false);
  };

  // ---- 語彙単位の操作 ----
  const addVocab = () => {
    setVocabs((p) => [...p, { id: genId(), name: "", properties: [""] }]);
    dirty();
  };
  const removeVocab = (id: string) => {
    setVocabs((p) => p.filter((v) => v.id !== id));
    dirty();
  };
  const renameVocab = (id: string, name: string) => {
    setVocabs((p) => p.map((v) => (v.id === id ? { ...v, name } : v)));
    dirty();
  };

  // ---- プロパティ単位の操作 ----
  const addProperty = (id: string) => {
    setVocabs((p) =>
      p.map((v) => (v.id === id ? { ...v, properties: [...v.properties, ""] } : v))
    );
    dirty();
  };
  const updateProperty = (id: string, index: number, value: string) => {
    setVocabs((p) =>
      p.map((v) =>
        v.id === id
          ? { ...v, properties: v.properties.map((f, i) => (i === index ? value : f)) }
          : v
      )
    );
    dirty();
  };
  const removeProperty = (id: string, index: number) => {
    setVocabs((p) =>
      p.map((v) =>
        v.id === id
          ? { ...v, properties: v.properties.filter((_, i) => i !== index) }
          : v
      )
    );
    dirty();
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const cleaned = await saveVocabularies(user.uid, vocabs);
      setVocabs(cleaned);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save vocabulary:", err);
    } finally {
      setSaving(false);
    }
  };

  // ---- Export / Import（複数人での共有用） ----
  const handleExport = () => {
    const data = JSON.stringify(normalizeVocabularies(vocabs), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "metadata-vocabularies.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const imported = normalizeVocabularies(JSON.parse(text));
      if (imported.length === 0) {
        setImportError(true);
        return;
      }
      // 既存と同名の語彙はプロパティをマージ、無ければ新規追加
      setVocabs((prev) => {
        const byName = new Map(prev.map((v) => [v.name, v]));
        for (const imp of imported) {
          const cur = byName.get(imp.name);
          if (cur) {
            const props = [...cur.properties];
            for (const p of imp.properties) if (!props.includes(p)) props.push(p);
            byName.set(imp.name, { ...cur, properties: props });
          } else {
            byName.set(imp.name, { ...imp, id: genId() });
          }
        }
        return Array.from(byName.values());
      });
      setImportError(false);
      setSaved(false);
    } catch {
      setImportError(true);
    }
  };

  if (!user) return null;

  return (
    <Card className="mb-8">
      <CardContent className="px-6 pt-5 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <Tags className="h-5 w-5 text-[var(--ds-primary)]" />
          <h2 className="text-xl font-bold text-[var(--ds-fg)]">{t("title")}</h2>
        </div>
        <p className="text-sm text-[var(--ds-fg-muted)] mb-4">{t("description")}</p>

        {loading ? (
          <div className="py-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--ds-primary)]" />
          </div>
        ) : (
          <>
            {vocabs.length === 0 && (
              <p className="text-sm text-[var(--ds-fg-muted)] py-4">{t("empty")}</p>
            )}

            <div className="space-y-4">
              {vocabs.map((vocab) => (
                <div
                  key={vocab.id}
                  className="border border-[var(--ds-border)] rounded-md p-3"
                >
                  {/* 語彙名 + 削除 */}
                  <div className="flex items-center gap-2 mb-3">
                    <Tags className="h-4 w-4 text-[var(--ds-fg-muted)] shrink-0" />
                    <input
                      type="text"
                      value={vocab.name}
                      onChange={(e) => renameVocab(vocab.id, e.target.value)}
                      placeholder={t("vocabularyNamePlaceholder")}
                      className="flex-1 p-2 font-medium border rounded-md bg-[var(--ds-bg)]
                        border-[var(--ds-border)] text-[var(--ds-fg)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeVocab(vocab.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                      title={t("removeVocabulary")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* プロパティ群 */}
                  <div className="space-y-2 pl-6">
                    {vocab.properties.map((field, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={field}
                          onChange={(e) => updateProperty(vocab.id, index, e.target.value)}
                          placeholder={t("fieldPlaceholder")}
                          className="flex-1 p-2 border rounded-md bg-[var(--ds-bg)]
                            border-[var(--ds-border)] text-[var(--ds-fg)]"
                        />
                        <button
                          type="button"
                          onClick={() => removeProperty(vocab.id, index)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                          title={t("removeField")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addProperty(vocab.id)}
                      className={buttonClass("secondary", "sm", "gap-2")}
                    >
                      <Plus className="h-4 w-4" />
                      {t("addField")}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* アクション */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button
                type="button"
                onClick={addVocab}
                className={buttonClass("secondary", "sm", "gap-2")}
              >
                <Plus className="h-4 w-4" />
                {t("addVocabulary")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={buttonClass("primary", "sm", "gap-2")}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="h-4 w-4" />
                ) : null}
                {saved ? t("saved") : t("save")}
              </button>

              <span className="mx-1 h-5 w-px bg-[var(--ds-border)]" />

              <button
                type="button"
                onClick={handleExport}
                className={buttonClass("secondary", "sm", "gap-2")}
              >
                <Download className="h-4 w-4" />
                {t("export")}
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={buttonClass("secondary", "sm", "gap-2")}
              >
                <Upload className="h-4 w-4" />
                {t("import")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            {importError && (
              <p className="text-sm text-red-600 mt-2">{t("importError")}</p>
            )}
            <p className="text-xs text-[var(--ds-fg-muted)] mt-2">{t("importHint")}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

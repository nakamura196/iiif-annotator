// メタデータ語彙の純粋ロジック（Firestore / firebase に非依存）。
// client lib (metadataVocabulary.ts) と API route の双方から使い、
// 正規化・旧形式移行・名前マージ・プロパティ追記の挙動を 1 箇所に集約する。
// ここはユニットテストの対象（src/lib/metadataVocabulary.helpers.test.ts）。

/** 名前付きの項目集合（≒ Omeka S のリソーステンプレート）。 */
export interface Vocabulary {
  id: string; // 安定キー（選択・操作用）
  name: string; // 表示名（例: pj-a）
  properties: string[]; // 項目名リスト
}

/** ブラウザ / Node 双方で使える ID 生成。 */
export function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "v-" + Math.random().toString(36).slice(2, 10);
}

/** 文字列配列を正規化（空白除去・重複除去・順序維持）。 */
export function cleanProperties(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of input) {
    if (typeof f !== "string") continue;
    const v = f.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * 任意の入力を Vocabulary[] へ正規化する。
 * - 配列でない / 各要素がオブジェクトでない場合は捨てる
 * - name が空（空白のみ含む）の語彙は捨てる
 * - id が無ければ採番する
 * - properties は cleanProperties で正規化
 */
export function normalizeVocabularies(input: unknown): Vocabulary[] {
  if (!Array.isArray(input)) return [];
  const out: Vocabulary[] = [];
  for (const v of input) {
    if (!v || typeof v !== "object") continue;
    const raw = v as Partial<Vocabulary>;
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) continue;
    const id = typeof raw.id === "string" && raw.id ? raw.id : genId();
    out.push({ id, name, properties: cleanProperties(raw.properties) });
  }
  return out;
}

/**
 * Firestore ドキュメントの data から語彙一覧を取り出す。
 * 新形式 { vocabularies } を優先し、旧形式 { fields: string[] } は
 * 「既定」語彙 1 件へ移行する。
 */
export function vocabulariesFromDoc(
  data: Record<string, unknown> | undefined | null
): Vocabulary[] {
  if (!data) return [];
  if (Array.isArray(data.vocabularies)) return normalizeVocabularies(data.vocabularies);
  if (Array.isArray(data.fields)) {
    const properties = cleanProperties(data.fields);
    if (properties.length > 0) return [{ id: genId(), name: "既定", properties }];
  }
  return [];
}

/**
 * current に incoming を「語彙名」をキーにマージする。
 * 同名があればプロパティを和集合（順序維持）、無ければ新規追加（id は採番し直す）。
 * Import や API POST（追記）で使う。
 */
export function mergeVocabulariesByName(
  current: Vocabulary[],
  incoming: Vocabulary[]
): Vocabulary[] {
  const byName = new Map<string, Vocabulary>(current.map((v) => [v.name, v]));
  for (const imp of incoming) {
    const cur = byName.get(imp.name);
    if (cur) {
      const props = [...cur.properties];
      for (const p of imp.properties) if (!props.includes(p)) props.push(p);
      byName.set(imp.name, { ...cur, properties: props });
    } else {
      byName.set(imp.name, { ...imp, id: imp.id || genId() });
    }
  }
  return Array.from(byName.values());
}

/**
 * 指定語彙 vocabId に新しいプロパティを追記した新しい配列を返す（純粋関数）。
 * 語彙が無い / 追加が無い場合は元の配列をそのまま返す（参照同一）。
 */
export function addPropertiesTo(
  vocabs: Vocabulary[],
  vocabId: string,
  newProperties: string[]
): Vocabulary[] {
  const target = vocabs.find((v) => v.id === vocabId);
  if (!target) return vocabs;
  const merged = [...target.properties];
  for (const f of newProperties) {
    const v = (f || "").trim();
    if (v && !merged.includes(v)) merged.push(v);
  }
  if (merged.length === target.properties.length) return vocabs;
  return vocabs.map((v) => (v.id === vocabId ? { ...v, properties: merged } : v));
}

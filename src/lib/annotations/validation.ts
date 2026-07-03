// アノテーション API の入力検証（純粋関数。Firestore に依存しないので単体テストしやすい）。
//
// 作成 (POST) と更新 (PUT) で必須項目が違う:
//   - 作成: manifestId / canvasId / target(セレクタ付き) が必須
//   - 更新: 部分更新を許す（渡された項目だけ検証）
// body は任意（空テキストのアノテーションも許容）。metadata は {label, value} の配列。

export interface MetadataPair {
  label: string;
  value: string;
}

export interface AnnotationBody {
  type?: string;
  value: string;
}

export interface AnnotationInput {
  manifestId?: string;
  canvasId?: string;
  motivation?: string;
  type?: string;
  body?: AnnotationBody;
  // セレクタの形は IIIF/Annotorious 由来で揺れがあるため unknown 受けにし、存在のみ検証する。
  target?: unknown;
  metadata?: MetadataPair[];
  // 自由記述のタグ（例: "OCR"）。メタデータスキーマ({label,value})とは別立ての単純な文字列集合。
  tags?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  value: AnnotationInput;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** target に「セレクタらしきもの」が含まれているか（オブジェクト or 配列）。 */
function hasSelector(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const selector = (target as { selector?: unknown }).selector;
  if (!selector) return false;
  if (Array.isArray(selector)) return selector.length > 0;
  return typeof selector === 'object';
}

/** metadata を {label, value} 両方が非空の行だけに正規化。配列でなければ undefined。 */
export function normalizeMetadata(raw: unknown): MetadataPair[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const cleaned = raw
    .filter(
      (m): m is MetadataPair =>
        !!m &&
        typeof m === 'object' &&
        isNonEmptyString((m as MetadataPair).label) &&
        isNonEmptyString((m as MetadataPair).value)
    )
    .map((m) => ({ label: String(m.label).trim(), value: String(m.value).trim() }));
  return cleaned;
}

/** tags を「非空・trim 済み・重複排除」の文字列配列に正規化。配列でなければ undefined。
 *  空配列はそのまま返す（＝更新時に全タグ削除を表現できる）。 */
export function normalizeTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t !== 'string') continue;
    const s = t.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function normalizeBody(raw: unknown): AnnotationBody | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { type?: unknown; value?: unknown };
  if (typeof r.value !== 'string') return undefined;
  return {
    type: isNonEmptyString(r.type) ? String(r.type) : 'TextualBody',
    value: r.value,
  };
}

/** 共通の項目正規化（type/motivation/body/metadata/target/manifestId/canvasId）。 */
function normalizeCommon(input: AnnotationInput): AnnotationInput {
  const value: AnnotationInput = {};
  if (input.manifestId !== undefined) value.manifestId = String(input.manifestId);
  if (input.canvasId !== undefined) value.canvasId = String(input.canvasId);
  if (input.motivation !== undefined) value.motivation = String(input.motivation);
  if (input.type !== undefined) value.type = String(input.type);
  if (input.target !== undefined) value.target = input.target;
  const body = normalizeBody(input.body);
  if (body) value.body = body;
  const metadata = normalizeMetadata(input.metadata);
  if (metadata) value.metadata = metadata;
  const tags = normalizeTags(input.tags);
  if (tags !== undefined) value.tags = tags;
  return value;
}

/** 作成入力の検証。manifestId / canvasId / target(セレクタ) を必須にする。 */
export function validateCreate(input: AnnotationInput): ValidationResult {
  const errors: string[] = [];
  const value = normalizeCommon(input);

  if (!isNonEmptyString(value.manifestId)) errors.push('manifestId is required');
  if (!isNonEmptyString(value.canvasId)) errors.push('canvasId is required');
  if (!hasSelector(value.target)) errors.push('target.selector is required');

  // 既定値を補う
  if (value.motivation === undefined) value.motivation = 'commenting';
  if (value.type === undefined) value.type = 'Annotation';
  if (value.body === undefined) value.body = { type: 'TextualBody', value: '' };

  return { valid: errors.length === 0, errors, value };
}

/** 更新入力の検証。部分更新を許すが、渡された target はセレクタ必須。空更新は不可。 */
export function validateUpdate(input: AnnotationInput): ValidationResult {
  const errors: string[] = [];
  const value = normalizeCommon(input);

  if (value.target !== undefined && !hasSelector(value.target)) {
    errors.push('target must contain a selector when provided');
  }

  const hasAnyField =
    value.body !== undefined ||
    value.target !== undefined ||
    value.motivation !== undefined ||
    value.metadata !== undefined ||
    value.tags !== undefined ||
    value.type !== undefined;
  if (!hasAnyField) errors.push('no updatable fields provided');

  return { valid: errors.length === 0, errors, value };
}

// アノテーションのサーバ側 CRUD（Firebase Admin SDK 経由）。
//
// データモデル: 1 (manifest, canvas) を「ページ・シャード」ドキュメント群に分けて格納する。
//   コレクション `annotationPages`。その canvas のアノテーションを items[] にまとめて持つが、
//   Firestore の 1 ドキュメント上限は 1 MiB のため、1 コマに 1,000 件超が付く国絵図では
//   単一ドキュメントに収まらない。そこでバイトサイズで自動的にシャード分割する:
//
//     docId = `${base}_${shard}`   base = sha256(userId '\n' manifestId '\n' canvasId), shard = 0,1,2...
//     { userId, manifestId, canvasId, base, shard, items:[...], created, modified }
//
//   base に manifestId を含めるのは、同一 canvasId が複数 manifest から参照され得る IIIF で、
//   manifest ごとにアノテーション集合を分けるため（旧実装は (manifestId, canvasId) で絞っていた）。
//
//   これにより「canvas 表示 = シャード数だけの read」になり、1件=1ドキュメントの旧方式
//   （件数分の read で無料枠を溶かした）から桁違いに読み取りを削減しつつ、各ドキュメントは
//   1 MiB 未満に保たれる。典型的なコマ（数百件以下）はシャード 1 個＝1 read。
//
// 設計の要:
//   - item.id は `${docId}:${suffix}` の合成 ID。更新/削除時に id だけから所属シャードを
//     特定できる（DELETE はボディを持てないため、id 単体で場所が分かる必要がある）。
//   - 書き込みは対象シャードを ID 直参照したトランザクションで行う（read-modify-write を
//     直列化し、同一ユーザが 2 タブでも壊れない）。
//   - 所有者チェックは Admin SDK 上でも明示（Admin はルールをバイパスするため、
//     シャードの userId と request の userId を必ず照合する）。

import { createHash, randomUUID } from 'crypto';
import { getAdminFirestore } from '@/lib/firebase-admin';
import type { AnnotationInput } from './validation';

const COLLECTION = 'annotationPages';

// items 部分の JSON バイト数がこれを超えたら新しいシャードに回す。1 MiB(=1,048,576) に対し
// フィールド名やエンコード差分の余裕を大きく取った保守的な値。
const SHARD_SOFT_LIMIT_BYTES = 700_000;
// これを超える書き込みは Firestore の 1 MiB 上限に近すぎるため拒否する（保存喪失=500 を防ぐ）。
const SHARD_HARD_LIMIT_BYTES = 1_000_000;

export class AnnotationError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AnnotationError';
    this.status = status;
  }
}

/** (userId, manifestId, canvasId) → シャード ID の基底（sha256 hex, 64 文字）。 */
export function baseIdFor(userId: string, manifestId: string, canvasId: string): string {
  return createHash('sha256').update(`${userId}\n${manifestId}\n${canvasId}`).digest('hex');
}

/** 合成 item id (`${docId}:${suffix}`) から所属シャードの docId を取り出す。壊れた形式は null。 */
function shardIdFromItemId(id: string): string | null {
  const idx = id.indexOf(':');
  if (idx < 0) return null;
  const docId = id.slice(0, idx);
  return /^[0-9a-f]{64}_\d+$/.test(docId) ? docId : null;
}

export interface StoredItem {
  id: string;
  motivation?: string;
  type?: string;
  body?: unknown;
  target?: unknown;
  metadata?: unknown;
  userName?: string | null;
  created?: unknown;
  modified?: unknown;
}

export interface SerializedAnnotation {
  id: string;
  manifestId?: string;
  canvasId?: string;
  motivation?: string;
  type?: string;
  body?: unknown;
  target?: unknown;
  metadata?: unknown;
  userId?: string;
  userName?: string | null;
  created: string | null;
  modified: string | null;
}

interface PageMeta {
  manifestId?: string;
  canvasId?: string;
  userId?: string;
}

function toIso(ts: unknown): string | null {
  if (!ts) return null;
  const maybe = ts as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

/** シャード内 item を API レスポンス用に整形。manifestId/canvasId/userId は親シャードから補う。 */
function serializeItem(item: StoredItem, page: PageMeta): SerializedAnnotation {
  const { created, modified, ...rest } = item;
  return {
    ...rest,
    manifestId: page.manifestId,
    canvasId: page.canvasId,
    userId: page.userId,
    created: toIso(created),
    modified: toIso(modified),
  };
}

function itemsOf(data: FirebaseFirestore.DocumentData): StoredItem[] {
  return Array.isArray(data.items) ? (data.items as StoredItem[]) : [];
}

function shardNumOf(docId: string): number {
  const n = Number(docId.slice(docId.lastIndexOf('_') + 1));
  return Number.isFinite(n) ? n : 0;
}

function itemsByteSize(items: StoredItem[]): number {
  return Buffer.byteLength(JSON.stringify(items), 'utf8');
}

export interface CreateOptions {
  userName?: string | null;
  /** テスト等で時刻を固定したい場合に注入。既定は new Date()。 */
  now?: Date;
}

export async function createAnnotation(
  userId: string,
  input: AnnotationInput,
  options: CreateOptions = {}
): Promise<SerializedAnnotation> {
  const db = getAdminFirestore();
  const manifestId = input.manifestId as string;
  const canvasId = input.canvasId as string;
  const base = baseIdFor(userId, manifestId, canvasId);
  const now = options.now ?? new Date();

  // 追加する item の中身（id は最後に採番）。サイズ見積りのため先に組み立てる。
  const item: StoredItem = {
    id: '',
    motivation: input.motivation ?? 'commenting',
    type: input.type ?? 'Annotation',
    body: input.body ?? { type: 'TextualBody', value: '' },
    target: input.target,
    userName: options.userName ?? null,
    created: now,
    modified: now,
  };
  if (input.metadata !== undefined) item.metadata = input.metadata;
  // id は `${64hex}_${shard}:${uuid}` 形。実長に近い定数でサイズを見積もる。
  const newItemBytes = itemsByteSize([{ ...item, id: `${base}_0:${randomUUID()}` }]);

  // 「追加してもソフト上限を超えないシャード」を辞書順で最初に見つけたものへ入れる。
  // 無ければ新規シャード（単体で上限超の巨大 item もここで単独シャードに載る）。
  const shardsSnap = await db
    .collection(COLLECTION)
    .where('userId', '==', userId)
    .where('manifestId', '==', manifestId)
    .where('canvasId', '==', canvasId)
    .get();

  let targetDocId: string | null = null;
  let maxShard = -1;
  for (const doc of shardsSnap.docs) {
    const data = doc.data() as FirebaseFirestore.DocumentData;
    maxShard = Math.max(maxShard, shardNumOf(doc.id));
    if (targetDocId === null && itemsByteSize(itemsOf(data)) + newItemBytes <= SHARD_SOFT_LIMIT_BYTES) {
      targetDocId = doc.id;
    }
  }
  const isNewShard = targetDocId === null;
  const shard = isNewShard ? maxShard + 1 : shardNumOf(targetDocId!);
  const docId = isNewShard ? `${base}_${shard}` : targetDocId!;
  const ref = db.collection(COLLECTION).doc(docId);
  item.id = `${docId}:${randomUUID()}`;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const items = itemsOf(snap.data() as FirebaseFirestore.DocumentData);
      items.push(item);
      // 事前クエリと tx の間に別書き込みでシャードが膨らんだ場合のハード上限ガード。
      if (itemsByteSize(items) > SHARD_HARD_LIMIT_BYTES) {
        throw new AnnotationError(413, 'Annotation is too large to store on this canvas shard');
      }
      tx.update(ref, { items, modified: now });
    } else {
      tx.set(ref, {
        userId,
        manifestId,
        canvasId,
        base,
        shard,
        userName: options.userName ?? null,
        created: now,
        modified: now,
        items: [item],
      });
    }
  });

  return serializeItem(item, { manifestId, canvasId, userId });
}

export async function getAnnotation(id: string): Promise<SerializedAnnotation | null> {
  const docId = shardIdFromItemId(id);
  if (!docId) return null;
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTION).doc(docId).get();
  if (!snap.exists) return null;
  const data = snap.data() as FirebaseFirestore.DocumentData;
  const item = itemsOf(data).find((it) => it.id === id);
  return item ? serializeItem(item, data) : null;
}

export async function updateAnnotation(
  userId: string,
  id: string,
  input: AnnotationInput,
  options: { now?: Date } = {}
): Promise<SerializedAnnotation> {
  const docId = shardIdFromItemId(id);
  if (!docId) throw new AnnotationError(404, 'Annotation not found');
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTION).doc(docId);
  const now = options.now ?? new Date();

  let result: SerializedAnnotation | undefined;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AnnotationError(404, 'Annotation not found');
    const data = snap.data() as FirebaseFirestore.DocumentData;
    if (data.userId !== userId) {
      throw new AnnotationError(403, 'You do not have permission to modify this annotation');
    }
    const items = itemsOf(data);
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) throw new AnnotationError(404, 'Annotation not found');

    const patched: StoredItem = { ...items[idx], modified: now };
    if (input.body !== undefined) patched.body = input.body;
    if (input.target !== undefined) patched.target = input.target;
    if (input.motivation !== undefined) patched.motivation = input.motivation;
    if (input.type !== undefined) patched.type = input.type;
    if (input.metadata !== undefined) patched.metadata = input.metadata;

    items[idx] = patched;
    if (itemsByteSize(items) > SHARD_HARD_LIMIT_BYTES) {
      throw new AnnotationError(413, 'Annotation is too large to store on this canvas shard');
    }
    tx.update(ref, { items, modified: now });
    result = serializeItem(patched, data);
  });

  return result as SerializedAnnotation;
}

export async function deleteAnnotation(userId: string, id: string): Promise<void> {
  const docId = shardIdFromItemId(id);
  if (!docId) throw new AnnotationError(404, 'Annotation not found');
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTION).doc(docId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AnnotationError(404, 'Annotation not found');
    const data = snap.data() as FirebaseFirestore.DocumentData;
    if (data.userId !== userId) {
      throw new AnnotationError(403, 'You do not have permission to delete this annotation');
    }
    const items = itemsOf(data);
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) throw new AnnotationError(404, 'Annotation not found');

    items.splice(idx, 1);
    if (items.length === 0) {
      tx.delete(ref);
    } else {
      tx.update(ref, { items, modified: new Date() });
    }
  });
}

export interface AnnotationsByManifest {
  manifestId: string;
  items: SerializedAnnotation[];
}

/** 指定ユーザの、指定 (manifest, canvas) のアノテーションを返す（シャード数だけの read）。 */
export async function listCanvasAnnotations(
  userId: string,
  manifestId: string,
  canvasId: string
): Promise<SerializedAnnotation[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(COLLECTION)
    .where('userId', '==', userId)
    .where('manifestId', '==', manifestId)
    .where('canvasId', '==', canvasId)
    .get();

  return snapshot.docs
    .sort((a, b) => shardNumOf(a.id) - shardNumOf(b.id))
    .flatMap((doc) => {
      const data = doc.data() as FirebaseFirestore.DocumentData;
      return itemsOf(data).map((it) => serializeItem(it, data));
    });
}

/** 指定ユーザの全アノテーションを返す（my-annotations 用。read はシャード数だけ）。 */
export async function listAllUserAnnotations(userId: string): Promise<SerializedAnnotation[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(COLLECTION).where('userId', '==', userId).get();
  return snapshot.docs.flatMap((doc) => {
    const data = doc.data() as FirebaseFirestore.DocumentData;
    return itemsOf(data).map((it) => serializeItem(it, data));
  });
}

/** 指定ユーザの、指定 manifest 群に紐づくアノテーションを manifest ごとにまとめて返す。 */
export async function listAnnotationsByManifests(
  userId: string,
  manifestIds: string[]
): Promise<AnnotationsByManifest[]> {
  const db = getAdminFirestore();
  const result: AnnotationsByManifest[] = [];

  for (const manifestId of manifestIds) {
    const snapshot = await db
      .collection(COLLECTION)
      .where('userId', '==', userId)
      .where('manifestId', '==', manifestId)
      .get();

    const items = snapshot.docs.flatMap((doc) => {
      const data = doc.data() as FirebaseFirestore.DocumentData;
      return itemsOf(data).map((it) => serializeItem(it, data));
    });
    result.push({ manifestId, items });
  }

  return result;
}

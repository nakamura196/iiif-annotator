// アノテーションのサーバ側 CRUD（Firebase Admin SDK 経由）。
//
// 設計の要:
//   - ドキュメント ID を「権威ある id」とする（doc.id を最優先で返す）。
//     旧実装はクライアントから渡された id を Firestore の doc ID として参照していたため、
//     Annotorious の一時 ID とズレて update/delete が静かに失敗していた。サーバ側で
//     doc ID を一意の真実とすることでこの不整合を構造的に解消する。
//   - 所有者チェックは Admin SDK 上でも明示的に行う（Admin はセキュリティルールを
//     バイパスするため、ここで request の userId と resource.userId を必ず照合する）。

import { getAdminFirestore } from '@/lib/firebase-admin';
import type { AnnotationInput } from './validation';

const COLLECTION = 'annotations';

export class AnnotationError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AnnotationError';
    this.status = status;
  }
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

function toIso(ts: unknown): string | null {
  if (!ts) return null;
  // Firestore Timestamp / Date / {toDate} を許容
  const maybe = ts as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

/** Firestore ドキュメントを API レスポンス用に整形。id は必ず doc.id を使う。 */
export function serializeAnnotation(
  id: string,
  data: FirebaseFirestore.DocumentData
): SerializedAnnotation {
  const { created, modified, ...rest } = data;
  return {
    ...rest,
    id, // doc.id を最優先（data.id が古くても上書き）
    created: toIso(created),
    modified: toIso(modified),
  };
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
  const docRef = db.collection(COLLECTION).doc();
  const now = options.now ?? new Date();

  const data: FirebaseFirestore.DocumentData = {
    manifestId: input.manifestId,
    canvasId: input.canvasId,
    motivation: input.motivation ?? 'commenting',
    type: input.type ?? 'Annotation',
    body: input.body ?? { type: 'TextualBody', value: '' },
    target: input.target,
    id: docRef.id,
    userId,
    userName: options.userName ?? null,
    created: now,
    modified: now,
  };
  if (input.metadata !== undefined) data.metadata = input.metadata;

  await docRef.set(data);
  return serializeAnnotation(docRef.id, data);
}

export async function getAnnotation(id: string): Promise<SerializedAnnotation | null> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return serializeAnnotation(snap.id, snap.data() as FirebaseFirestore.DocumentData);
}

export async function updateAnnotation(
  userId: string,
  id: string,
  input: AnnotationInput,
  options: { now?: Date } = {}
): Promise<SerializedAnnotation> {
  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new AnnotationError(404, 'Annotation not found');
  }
  const existing = snap.data() as FirebaseFirestore.DocumentData;
  if (existing.userId !== userId) {
    throw new AnnotationError(403, 'You do not have permission to modify this annotation');
  }

  const now = options.now ?? new Date();
  const patch: FirebaseFirestore.DocumentData = { modified: now };
  if (input.body !== undefined) patch.body = input.body;
  if (input.target !== undefined) patch.target = input.target;
  if (input.motivation !== undefined) patch.motivation = input.motivation;
  if (input.type !== undefined) patch.type = input.type;
  if (input.manifestId !== undefined) patch.manifestId = input.manifestId;
  if (input.canvasId !== undefined) patch.canvasId = input.canvasId;
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  await docRef.update(patch);
  return serializeAnnotation(id, { ...existing, ...patch });
}

export async function deleteAnnotation(userId: string, id: string): Promise<void> {
  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new AnnotationError(404, 'Annotation not found');
  }
  const existing = snap.data() as FirebaseFirestore.DocumentData;
  if (existing.userId !== userId) {
    throw new AnnotationError(403, 'You do not have permission to delete this annotation');
  }

  await docRef.delete();
}

export interface AnnotationsByManifest {
  manifestId: string;
  items: SerializedAnnotation[];
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

    const items = snapshot.docs.map((doc) =>
      serializeAnnotation(doc.id, doc.data() as FirebaseFirestore.DocumentData)
    );
    result.push({ manifestId, items });
  }

  return result;
}

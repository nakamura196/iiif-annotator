import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { validateApiKey } from '@/lib/apiKeyManager';
import {
  type Vocabulary,
  normalizeVocabularies,
  vocabulariesFromDoc,
  mergeVocabulariesByName,
} from '@/lib/metadataVocabulary.helpers';

// ユーザ単位のメタデータ語彙を API キー(X-API-Key)経由で取得/設定する。
// 設定UIと同じ Firestore ドキュメント (metadata_vocabularies/{userId}) を読み書きする。
//
// 語彙 = 名前付きのプロパティ集合（≒ Omeka S のリソーステンプレート）:
//   Vocabulary = { id, name, properties: string[] }
//
//   GET    /api/metadata-vocabulary                   -> { userId, vocabularies }
//   PUT    /api/metadata-vocabulary  {vocabularies}   -> 置き換え
//   POST   /api/metadata-vocabulary  {vocabularies}   -> 同名はプロパティをマージ、無ければ追加
const COLLECTION = 'metadata_vocabularies';

type AuthOk = { userId: string };
type AuthErr = { error: NextResponse };

async function authenticate(request: NextRequest): Promise<AuthOk | AuthErr> {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) {
    return {
      error: NextResponse.json(
        { error: 'X-API-Key header is required' },
        { status: 401 }
      ),
    };
  }
  const validation = await validateApiKey(apiKey);
  if (!validation.valid) {
    return { error: NextResponse.json({ error: validation.error }, { status: 401 }) };
  }
  return { userId: validation.userId! };
}

async function readVocabularies(userId: string): Promise<Vocabulary[]> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTION).doc(userId).get();
  if (!snap.exists) return [];
  return vocabulariesFromDoc(snap.data());
}

async function writeVocabularies(userId: string, vocabularies: Vocabulary[]): Promise<void> {
  const db = getAdminFirestore();
  // 旧 fields キーを残さないよう merge せず置換する
  await db
    .collection(COLLECTION)
    .doc(userId)
    .set({ vocabularies, modified: new Date() });
}

/** body.vocabularies を取り出して正規化。配列でなければ null。 */
function parseBodyVocabularies(body: unknown): Vocabulary[] | null {
  const raw = (body as { vocabularies?: unknown })?.vocabularies;
  if (!Array.isArray(raw)) return null;
  return normalizeVocabularies(raw);
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if ('error' in auth) return auth.error;
  try {
    const vocabularies = await readVocabularies(auth.userId);
    return NextResponse.json({ userId: auth.userId, vocabularies });
  } catch (error) {
    console.error('Error reading metadata vocabulary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await authenticate(request);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const vocabularies = parseBodyVocabularies(body);
  if (vocabularies === null) {
    return NextResponse.json(
      { error: 'vocabularies (Vocabulary[]) is required' },
      { status: 400 }
    );
  }

  try {
    await writeVocabularies(auth.userId, vocabularies);
    return NextResponse.json({ userId: auth.userId, vocabularies });
  } catch (error) {
    console.error('Error writing metadata vocabulary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const incoming = parseBodyVocabularies(body);
  if (incoming === null) {
    return NextResponse.json(
      { error: 'vocabularies (Vocabulary[]) is required' },
      { status: 400 }
    );
  }

  try {
    const current = await readVocabularies(auth.userId);
    const merged = mergeVocabulariesByName(current, incoming);
    await writeVocabularies(auth.userId, merged);
    return NextResponse.json({ userId: auth.userId, vocabularies: merged });
  } catch (error) {
    console.error('Error appending metadata vocabulary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

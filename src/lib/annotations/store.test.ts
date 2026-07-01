import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---- Firestore (Admin) のフェイク。Map で1コレクションを再現する ----
type Doc = Record<string, unknown>;
const collections: Record<string, Map<string, Doc>> = {};
let autoCounter = 0;

function getColl(name: string): Map<string, Doc> {
  if (!collections[name]) collections[name] = new Map();
  return collections[name];
}

function makeDocRef(name: string, id?: string) {
  const realId = id ?? `auto-${++autoCounter}`;
  const coll = getColl(name);
  return {
    id: realId,
    async set(data: Doc) {
      coll.set(realId, { ...data });
    },
    async get() {
      const exists = coll.has(realId);
      return {
        exists,
        id: realId,
        data: () => coll.get(realId),
      };
    },
    async update(patch: Doc) {
      coll.set(realId, { ...(coll.get(realId) || {}), ...patch });
    },
    async delete() {
      coll.delete(realId);
    },
  };
}

function makeQuery(name: string, filters: Array<[string, string, unknown]>) {
  return {
    where(field: string, op: string, value: unknown) {
      return makeQuery(name, [...filters, [field, op, value]]);
    },
    async get() {
      const coll = getColl(name);
      const docs = [...coll.entries()]
        .filter(([, data]) => filters.every(([f, , v]) => (data as Doc)[f] === v))
        .map(([id, data]) => ({ id, data: () => data }));
      return { docs, empty: docs.length === 0 };
    },
  };
}

type DocRef = ReturnType<typeof makeDocRef>;

const fakeDb = {
  collection(name: string) {
    return {
      doc: (id?: string) => makeDocRef(name, id),
      where: (field: string, op: string, value: unknown) =>
        makeQuery(name, [[field, op, value]]),
    };
  },
  // 実 Admin SDK の runTransaction を最小限に再現。tx 操作は docRef 経由で即時に Map へ反映。
  async runTransaction<T>(fn: (tx: {
    get: (ref: DocRef) => ReturnType<DocRef['get']>;
    set: (ref: DocRef, data: Doc) => void;
    update: (ref: DocRef, patch: Doc) => void;
    delete: (ref: DocRef) => void;
  }) => Promise<T>): Promise<T> {
    const tx = {
      get: (ref: DocRef) => ref.get(),
      set: (ref: DocRef, data: Doc) => {
        void ref.set(data);
      },
      update: (ref: DocRef, patch: Doc) => {
        void ref.update(patch);
      },
      delete: (ref: DocRef) => {
        void ref.delete();
      },
    };
    return fn(tx);
  },
};

vi.mock('@/lib/firebase-admin', () => ({
  getAdminFirestore: () => fakeDb,
}));

import {
  createAnnotation,
  getAnnotation,
  updateAnnotation,
  deleteAnnotation,
  listAnnotationsByManifests,
  listCanvasAnnotations,
  listAllUserAnnotations,
  AnnotationError,
} from './store';

const baseInput = {
  manifestId: 'https://example.com/m1',
  canvasId: 'https://example.com/m1/canvas/1',
  motivation: 'commenting',
  type: 'Annotation',
  body: { type: 'TextualBody', value: 'hello' },
  target: { selector: { type: 'FragmentSelector', value: 'xywh=1,2,3,4' } },
};

beforeEach(() => {
  for (const key of Object.keys(collections)) delete collections[key];
  autoCounter = 0;
});

describe('createAnnotation', () => {
  it('doc id を id として採番し、userId と timestamps を付与する', async () => {
    const now = new Date('2026-01-02T03:04:05.000Z');
    const created = await createAnnotation('user-1', baseInput, { now, userName: 'Taro' });
    expect(created.id).toBeTruthy();
    expect(created.userId).toBe('user-1');
    expect(created.userName).toBe('Taro');
    expect(created.created).toBe('2026-01-02T03:04:05.000Z');
    expect(created.modified).toBe('2026-01-02T03:04:05.000Z');
    // 保存後に取得しても同じ id が引ける
    const fetched = await getAnnotation(created.id);
    expect(fetched?.body).toEqual(baseInput.body);
  });
});

describe('updateAnnotation', () => {
  it('作成者なら更新でき modified が進む', async () => {
    const c = await createAnnotation('user-1', baseInput, {
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    const u = await updateAnnotation(
      'user-1',
      c.id,
      { body: { type: 'TextualBody', value: 'edited' } },
      { now: new Date('2026-02-01T00:00:00.000Z') }
    );
    expect((u.body as { value: string }).value).toBe('edited');
    expect(u.modified).toBe('2026-02-01T00:00:00.000Z');
    expect(u.created).toBe('2026-01-01T00:00:00.000Z'); // created は保持
  });

  it('別ユーザの更新は 403', async () => {
    const c = await createAnnotation('owner', baseInput);
    await expect(updateAnnotation('intruder', c.id, { body: { value: 'x' } })).rejects.toMatchObject(
      { status: 403 }
    );
  });

  it('存在しない id は 404', async () => {
    await expect(updateAnnotation('user-1', 'nope', { body: { value: 'x' } })).rejects.toBeInstanceOf(
      AnnotationError
    );
    await expect(updateAnnotation('user-1', 'nope', { body: { value: 'x' } })).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('deleteAnnotation', () => {
  it('作成者なら削除でき、以後 list に出ない', async () => {
    const c = await createAnnotation('user-1', baseInput);
    await deleteAnnotation('user-1', c.id);
    expect(await getAnnotation(c.id)).toBeNull();
  });

  it('別ユーザの削除は 403、ドキュメントは残る', async () => {
    const c = await createAnnotation('owner', baseInput);
    await expect(deleteAnnotation('intruder', c.id)).rejects.toMatchObject({ status: 403 });
    expect(await getAnnotation(c.id)).not.toBeNull();
  });
});

describe('listAnnotationsByManifests', () => {
  it('userId と manifestId で絞り込み、manifest ごとにまとめる', async () => {
    await createAnnotation('user-1', baseInput);
    // 別 manifest は別 canvas（canvasId は IIIF 上グローバル一意）。ページ集約でも別ドキュメントになる。
    await createAnnotation('user-1', {
      ...baseInput,
      manifestId: 'https://example.com/m2',
      canvasId: 'https://example.com/m2/canvas/1',
    });
    await createAnnotation('user-2', baseInput); // 別ユーザ（除外される）

    const res = await listAnnotationsByManifests('user-1', [
      'https://example.com/m1',
      'https://example.com/m2',
    ]);
    expect(res).toHaveLength(2);
    const m1 = res.find((r) => r.manifestId === 'https://example.com/m1')!;
    expect(m1.items).toHaveLength(1);
    expect(m1.items[0].userId).toBe('user-1');
  });

  it('同一 canvasId でも manifest が違えば分離される（base に manifestId を含むため）', async () => {
    const sharedCanvas = 'https://example.com/shared/canvas/1';
    await createAnnotation('user-1', { ...baseInput, manifestId: 'https://example.com/mA', canvasId: sharedCanvas });
    await createAnnotation('user-1', { ...baseInput, manifestId: 'https://example.com/mB', canvasId: sharedCanvas });

    // canvas 単位取得は (manifest, canvas) で絞るので、他 manifest 分が混ざらない。
    const aOnly = await listCanvasAnnotations('user-1', 'https://example.com/mA', sharedCanvas);
    expect(aOnly).toHaveLength(1);
    expect(aOnly[0].manifestId).toBe('https://example.com/mA');

    // manifest 単位取得でも B 分が欠落しない。
    const byManifest = await listAnnotationsByManifests('user-1', ['https://example.com/mB']);
    expect(byManifest[0].items).toHaveLength(1);
    expect(byManifest[0].items[0].manifestId).toBe('https://example.com/mB');
  });
});

describe('listAllUserAnnotations', () => {
  it('ユーザの全 (manifest, canvas) を跨いで全 item を返す', async () => {
    await createAnnotation('user-1', baseInput);
    await createAnnotation('user-1', {
      ...baseInput,
      manifestId: 'https://example.com/m2',
      canvasId: 'https://example.com/m2/canvas/1',
    });
    await createAnnotation('user-2', baseInput); // 別ユーザは含まれない

    const mine = await listAllUserAnnotations('user-1');
    expect(mine).toHaveLength(2);
    expect(mine.every((a) => a.userId === 'user-1')).toBe(true);
  });
});

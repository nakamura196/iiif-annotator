import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  user: { getIdToken: vi.fn() } as { getIdToken: () => Promise<string> } | null,
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: h.user }),
}));

import FirestoreAnnotationAdapter from './FirestoreAnnotationAdapter';

const MANIFEST = 'https://example.com/m1';
const CANVAS = 'https://example.com/m1/canvas/1';

function res(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function allResponse(items: unknown[]) {
  return res(200, { userId: 'u', annotations: [{ manifestId: MANIFEST, items }] });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  h.user = { getIdToken: vi.fn().mockResolvedValue('tok-123') };
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('FirestoreAnnotationAdapter (API 経由)', () => {
  it('all() は ID トークンを付けて canvas スコープで GET する（サーバが canvas 単位に絞る）', async () => {
    // サーバは canvasId 指定でその canvas のシャードだけを返す（= 数 read）。
    fetchMock.mockResolvedValueOnce(allResponse([{ id: 'a1', canvasId: CANVAS, body: { value: 'x' } }]));
    const adapter = new FirestoreAnnotationAdapter(CANVAS, MANIFEST);
    const page = await adapter.all();

    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe('a1');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/annotations?manifestIds=');
    expect(url).toContain(`canvasId=${encodeURIComponent(CANVAS)}`);
    expect(opts.headers.Authorization).toBe('Bearer tok-123');
  });

  it('create() は POST のみ行い（二重フェッチしない）、レスポンスを返す', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { annotation: { id: 'new-1' } })); // POST のみ

    const adapter = new FirestoreAnnotationAdapter(CANVAS, MANIFEST);
    const result = await adapter.create({
      motivation: 'commenting',
      type: 'Annotation',
      body: { type: 'TextualBody', value: 'hi' },
      target: { selector: { type: 'FragmentSelector', value: 'xywh=0,0,1,1' } },
    });

    // 再取得は呼び出し側が 1 回だけ行う設計。ここでは POST の 1 回だけ。
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, postOpts] = fetchMock.mock.calls[0];
    expect(postOpts.method).toBe('POST');
    const sent = JSON.parse(postOpts.body);
    expect(sent.manifestId).toBe(MANIFEST);
    expect(sent.canvasId).toBe(CANVAS);
    expect(result.annotation.id).toBe('new-1');
  });

  it('update() は PUT /api/annotations/:id を 1 回だけ呼ぶ', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { annotation: { id: 'a1' } }));
    const adapter = new FirestoreAnnotationAdapter(CANVAS, MANIFEST);
    await adapter.update({ id: 'a1', body: { type: 'TextualBody', value: 'edited' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/annotations/${encodeURIComponent('a1')}`);
    expect(opts.method).toBe('PUT');
  });

  it('delete() は DELETE /api/annotations/:id を 1 回だけ呼ぶ', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { success: true }));
    const adapter = new FirestoreAnnotationAdapter(CANVAS, MANIFEST);
    await adapter.delete('a1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/annotations/${encodeURIComponent('a1')}`);
    expect(opts.method).toBe('DELETE');
  });

  it('失敗レスポンスはメッセージ付きで throw（握り潰さない）', async () => {
    fetchMock.mockResolvedValueOnce(res(403, { error: '権限がありません' }));
    const adapter = new FirestoreAnnotationAdapter(CANVAS, MANIFEST);
    await expect(adapter.delete('a1')).rejects.toThrow('権限がありません');
  });

  it('未ログイン時 create は alert して null（fetch しない）', async () => {
    h.user = null;
    const adapter = new FirestoreAnnotationAdapter(CANVAS, MANIFEST);
    const r = await adapter.create({ body: { value: 'x' } });
    expect(r).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalled();
  });

  it('ISO のタイムスタンプを {seconds} 形へ正規化する', async () => {
    fetchMock.mockResolvedValueOnce(
      allResponse([
        { id: 'a1', canvasId: CANVAS, created: '2026-01-01T00:00:00.000Z', modified: null },
      ])
    );
    const adapter = new FirestoreAnnotationAdapter(CANVAS, MANIFEST);
    const page = await adapter.all();
    expect(page.items[0].created).toMatchObject({ seconds: 1767225600 });
    expect(page.items[0].modified).toBeUndefined();
  });
});

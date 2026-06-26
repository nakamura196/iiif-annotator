import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse, type NextRequest } from 'next/server';

const authenticate = vi.fn();
vi.mock('@/lib/apiAuth', () => ({
  authenticate: (r: unknown) => authenticate(r),
  isAuthError: (x: unknown) => !!x && typeof x === 'object' && 'error' in x,
}));

const getAnnotation = vi.fn();
const updateAnnotation = vi.fn();
const deleteAnnotation = vi.fn();

vi.mock('@/lib/annotations/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/annotations/store')>();
  return {
    ...actual,
    getAnnotation: (...a: unknown[]) => getAnnotation(...a),
    updateAnnotation: (...a: unknown[]) => updateAnnotation(...a),
    deleteAnnotation: (...a: unknown[]) => deleteAnnotation(...a),
  };
});

import { GET, PUT, DELETE } from './route';
// モックは ...actual を返すため、AnnotationError は実クラスが得られる（instanceof 判定が一致）
import { AnnotationError } from '@/lib/annotations/store';

const params = (id: string) => ({ params: Promise.resolve({ id }) });
function jsonReq(body?: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: async () => body ?? {},
  } as unknown as NextRequest;
}

const okAuth = { userId: 'owner', via: 'api-key' as const };

beforeEach(() => {
  authenticate.mockReset();
  getAnnotation.mockReset();
  updateAnnotation.mockReset();
  deleteAnnotation.mockReset();
  authenticate.mockResolvedValue(okAuth);
});

describe('GET /api/annotations/:id', () => {
  it('存在すれば 200', async () => {
    getAnnotation.mockResolvedValue({ id: 'a1' });
    const res = await GET(jsonReq(), params('a1'));
    expect(res.status).toBe(200);
    expect((await res.json()).annotation.id).toBe('a1');
  });

  it('無ければ 404', async () => {
    getAnnotation.mockResolvedValue(null);
    const res = await GET(jsonReq(), params('x'));
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/annotations/:id', () => {
  it('正常更新で 200', async () => {
    updateAnnotation.mockResolvedValue({ id: 'a1', body: { value: 'edited' } });
    const res = await PUT(jsonReq({ body: { value: 'edited' } }), params('a1'));
    expect(res.status).toBe(200);
    expect(updateAnnotation).toHaveBeenCalledWith('owner', 'a1', expect.any(Object));
  });

  it('空更新は 400', async () => {
    const res = await PUT(jsonReq({}), params('a1'));
    expect(res.status).toBe(400);
    expect(updateAnnotation).not.toHaveBeenCalled();
  });

  it('所有者でない場合 store の 403 を伝える', async () => {
    updateAnnotation.mockRejectedValue(new AnnotationError(403, 'forbidden'));
    const res = await PUT(jsonReq({ body: { value: 'x' } }), params('a1'));
    expect(res.status).toBe(403);
  });

  it('存在しない場合 404', async () => {
    updateAnnotation.mockRejectedValue(new AnnotationError(404, 'not found'));
    const res = await PUT(jsonReq({ body: { value: 'x' } }), params('a1'));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/annotations/:id', () => {
  it('正常削除で 200', async () => {
    deleteAnnotation.mockResolvedValue(undefined);
    const res = await DELETE(jsonReq(), params('a1'));
    expect(res.status).toBe(200);
    expect(deleteAnnotation).toHaveBeenCalledWith('owner', 'a1');
  });

  it('所有者でない場合 403', async () => {
    deleteAnnotation.mockRejectedValue(new AnnotationError(403, 'forbidden'));
    const res = await DELETE(jsonReq(), params('a1'));
    expect(res.status).toBe(403);
  });

  it('未認証は 401（store を呼ばない）', async () => {
    authenticate.mockResolvedValue({ error: NextResponse.json({ error: 'no' }, { status: 401 }) });
    const res = await DELETE(jsonReq(), params('a1'));
    expect(res.status).toBe(401);
    expect(deleteAnnotation).not.toHaveBeenCalled();
  });
});

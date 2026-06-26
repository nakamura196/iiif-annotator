import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse, type NextRequest } from 'next/server';

const authenticate = vi.fn();
vi.mock('@/lib/apiAuth', () => ({
  authenticate: (r: unknown) => authenticate(r),
  isAuthError: (x: unknown) => !!x && typeof x === 'object' && 'error' in x,
}));

const listAnnotationsByManifests = vi.fn();
const createAnnotation = vi.fn();
vi.mock('@/lib/annotations/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/annotations/store')>();
  return {
    ...actual,
    listAnnotationsByManifests: (...a: unknown[]) => listAnnotationsByManifests(...a),
    createAnnotation: (...a: unknown[]) => createAnnotation(...a),
  };
});

import { GET, POST } from './route';

function getReq(qs: string): NextRequest {
  return {
    headers: new Headers(),
    nextUrl: new URL(`http://localhost/api/annotations${qs}`),
  } as unknown as NextRequest;
}
function postReq(body: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: async () => body,
  } as unknown as NextRequest;
}

const okAuth = { userId: 'u-1', via: 'api-key' as const };

beforeEach(() => {
  authenticate.mockReset();
  listAnnotationsByManifests.mockReset();
  createAnnotation.mockReset();
});

describe('GET /api/annotations', () => {
  it('manifest 群のアノテーションを返す', async () => {
    authenticate.mockResolvedValue(okAuth);
    listAnnotationsByManifests.mockResolvedValue([{ manifestId: 'm1', items: [] }]);
    const res = await GET(getReq('?manifestIds=m1,m2'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.userId).toBe('u-1');
    expect(listAnnotationsByManifests).toHaveBeenCalledWith('u-1', ['m1', 'm2']);
  });

  it('manifestIds 無しは 400', async () => {
    authenticate.mockResolvedValue(okAuth);
    const res = await GET(getReq(''));
    expect(res.status).toBe(400);
  });

  it('認証エラーをそのまま返す', async () => {
    authenticate.mockResolvedValue({ error: NextResponse.json({ error: 'no' }, { status: 401 }) });
    const res = await GET(getReq('?manifestIds=m1'));
    expect(res.status).toBe(401);
    expect(listAnnotationsByManifests).not.toHaveBeenCalled();
  });
});

describe('POST /api/annotations', () => {
  const validBody = {
    manifestId: 'm1',
    canvasId: 'c1',
    target: { selector: { type: 'FragmentSelector', value: 'xywh=0,0,1,1' } },
    body: { type: 'TextualBody', value: 'hi' },
  };

  it('正常入力で 201 と作成結果を返す', async () => {
    authenticate.mockResolvedValue(okAuth);
    createAnnotation.mockResolvedValue({ id: 'new-1', ...validBody });
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.annotation.id).toBe('new-1');
    expect(createAnnotation).toHaveBeenCalledWith('u-1', expect.objectContaining({ manifestId: 'm1' }));
  });

  it('必須欠落は 400（store を呼ばない）', async () => {
    authenticate.mockResolvedValue(okAuth);
    const res = await POST(postReq({ canvasId: 'c1' }));
    expect(res.status).toBe(400);
    expect(createAnnotation).not.toHaveBeenCalled();
  });

  it('未認証は 401', async () => {
    authenticate.mockResolvedValue({ error: NextResponse.json({ error: 'no' }, { status: 401 }) });
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(401);
    expect(createAnnotation).not.toHaveBeenCalled();
  });
});

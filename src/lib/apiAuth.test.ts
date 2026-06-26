import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const validateApiKey = vi.fn();
const verifyIdToken = vi.fn();

vi.mock('@/lib/apiKeyManager', () => ({
  validateApiKey: (k: string) => validateApiKey(k),
}));
vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuth: () => ({ verifyIdToken: (t: string) => verifyIdToken(t) }),
}));

import { authenticate, isAuthError } from './apiAuth';

function req(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

beforeEach(() => {
  validateApiKey.mockReset();
  verifyIdToken.mockReset();
});

describe('authenticate', () => {
  it('有効な X-API-Key で userId を返す', async () => {
    validateApiKey.mockResolvedValue({ valid: true, userId: 'u-key' });
    const r = await authenticate(req({ 'X-API-Key': 'abc' }));
    expect(isAuthError(r)).toBe(false);
    if (!isAuthError(r)) {
      expect(r.userId).toBe('u-key');
      expect(r.via).toBe('api-key');
    }
  });

  it('無効な API キーは 401', async () => {
    validateApiKey.mockResolvedValue({ valid: false, error: 'Invalid API key' });
    const r = await authenticate(req({ 'X-API-Key': 'bad' }));
    expect(isAuthError(r)).toBe(true);
    if (isAuthError(r)) expect(r.error.status).toBe(401);
  });

  it('Bearer ID トークンを検証して uid を返す', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u-token' });
    const r = await authenticate(req({ Authorization: 'Bearer tok123' }));
    expect(isAuthError(r)).toBe(false);
    if (!isAuthError(r)) {
      expect(r.userId).toBe('u-token');
      expect(r.via).toBe('id-token');
    }
    expect(verifyIdToken).toHaveBeenCalledWith('tok123');
  });

  it('壊れた ID トークンは 401', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad token'));
    const r = await authenticate(req({ Authorization: 'Bearer nope' }));
    expect(isAuthError(r)).toBe(true);
    if (isAuthError(r)) expect(r.error.status).toBe(401);
  });

  it('認証ヘッダ無しは 401', async () => {
    const r = await authenticate(req({}));
    expect(isAuthError(r)).toBe(true);
    if (isAuthError(r)) expect(r.error.status).toBe(401);
  });

  it('X-API-Key を Bearer より優先する', async () => {
    validateApiKey.mockResolvedValue({ valid: true, userId: 'u-key' });
    const r = await authenticate(req({ 'X-API-Key': 'abc', Authorization: 'Bearer tok' }));
    if (!isAuthError(r)) expect(r.via).toBe('api-key');
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});

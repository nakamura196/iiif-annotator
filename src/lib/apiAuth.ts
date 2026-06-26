import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/apiKeyManager';
import { getAdminAuth } from '@/lib/firebase-admin';

// アノテーション API の認証。2 方式に対応する:
//   1. X-API-Key             … 外部/サーバ用（kojima の日次取り込み等）。api_keys から userId を引く。
//   2. Authorization: Bearer … ブラウザ用。Firebase の ID トークンを Admin SDK で検証し uid を得る。
// どちらの場合も「操作主体の userId」を返し、所有権の判定に使う。

export interface AuthSuccess {
  userId: string;
  /** 認証方式（ログ/デバッグ用）。 */
  via: 'api-key' | 'id-token';
}

export type AuthResult = AuthSuccess | { error: NextResponse };

export function isAuthError(r: AuthResult): r is { error: NextResponse } {
  return 'error' in r;
}

function unauthorized(message: string): { error: NextResponse } {
  return { error: NextResponse.json({ error: message }, { status: 401 }) };
}

export async function authenticate(request: NextRequest): Promise<AuthResult> {
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey) {
    const validation = await validateApiKey(apiKey);
    if (!validation.valid) {
      return unauthorized(validation.error || 'Invalid API key');
    }
    return { userId: validation.userId!, via: 'api-key' };
  }

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.slice('Bearer '.length).trim();
    if (!idToken) {
      return unauthorized('Bearer token is empty');
    }
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      return { userId: decoded.uid, via: 'id-token' };
    } catch {
      return unauthorized('Invalid or expired ID token');
    }
  }

  return unauthorized('Authentication required: provide X-API-Key or Authorization: Bearer <idToken>');
}

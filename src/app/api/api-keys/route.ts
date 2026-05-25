import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth-utils';
import { createApiKey, listApiKeys } from '@/lib/apiKeyManager';

export async function GET(request: NextRequest) {
  const user = await verifyIdToken(request.headers.get('Authorization'));

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const keys = await listApiKeys(user.uid);
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Error listing API keys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await verifyIdToken(request.headers.get('Authorization'));

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, expiresInDays } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const result = await createApiKey(user.uid, name, expiresAt);

    return NextResponse.json({
      id: result.id,
      key: result.key,
      name,
      message: 'API key created. Save this key securely - it cannot be retrieved later.',
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

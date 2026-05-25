import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth-utils';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { ApiKeyDocument } from '@/types/apiKey';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyIdToken(request.headers.get('Authorization'));

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getAdminFirestore();
    const docRef = db.collection('api_keys').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    const data = doc.data() as ApiKeyDocument;

    if (data.userId !== user.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await docRef.delete();

    return NextResponse.json({ message: 'API key revoked' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

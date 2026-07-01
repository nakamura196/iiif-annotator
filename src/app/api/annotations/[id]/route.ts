import { NextRequest, NextResponse } from 'next/server';
import { authenticate, isAuthError } from '@/lib/apiAuth';
import {
  getAnnotation,
  updateAnnotation,
  deleteAnnotation,
  AnnotationError,
} from '@/lib/annotations/store';
import { validateUpdate, type AnnotationInput } from '@/lib/annotations/validation';
import { assertNotInMaintenance } from '@/lib/maintenance';

type Params = { params: Promise<{ id: string }> };

function handleStoreError(error: unknown): NextResponse {
  if (error instanceof AnnotationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error('Annotation store error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/** GET /api/annotations/:id — 単一アノテーション取得（読み取りは公開）。 */
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await authenticate(request);
  if (isAuthError(auth)) return auth.error;

  const { id } = await params;
  try {
    const annotation = await getAnnotation(id);
    if (!annotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }
    return NextResponse.json({ annotation });
  } catch (error) {
    return handleStoreError(error);
  }
}

/** PUT /api/annotations/:id — 更新（作成者のみ）。 */
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await authenticate(request);
  if (isAuthError(auth)) return auth.error;

  const blocked = await assertNotInMaintenance();
  if (blocked) return blocked;

  const { id } = await params;

  let body: AnnotationInput;
  try {
    body = (await request.json()) as AnnotationInput;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const { valid, errors, value } = validateUpdate(body);
  if (!valid) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  try {
    const updated = await updateAnnotation(auth.userId, id, value);
    return NextResponse.json({ annotation: updated });
  } catch (error) {
    return handleStoreError(error);
  }
}

/** DELETE /api/annotations/:id — 削除（作成者のみ）。 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await authenticate(request);
  if (isAuthError(auth)) return auth.error;

  const blocked = await assertNotInMaintenance();
  if (blocked) return blocked;

  const { id } = await params;
  try {
    await deleteAnnotation(auth.userId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleStoreError(error);
  }
}

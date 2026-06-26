import { NextRequest, NextResponse } from 'next/server';
import { convertPresentation2 } from '@iiif/parser/presentation-2';
import { authenticate, isAuthError } from '@/lib/apiAuth';
import {
  createAnnotation,
  listAnnotationsByManifests,
  type AnnotationsByManifest,
  type SerializedAnnotation,
} from '@/lib/annotations/store';
import { validateCreate, type AnnotationInput } from '@/lib/annotations/validation';

interface ApiResponse {
  userId: string;
  annotations: AnnotationsByManifest[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildIIIFManifest(manifestId: string, items: SerializedAnnotation[]): Promise<any> {
  const r = await fetch(manifestId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let manifestData: any = await r.json();

  const context = manifestData['@context'];
  if (typeof context === 'string' && context.includes('presentation/2')) {
    manifestData = convertPresentation2(manifestData);
  } else if (
    Array.isArray(context) &&
    context.some((c: string) => typeof c === 'string' && c.includes('presentation/2'))
  ) {
    manifestData = convertPresentation2(manifestData);
  }

  const canvases = manifestData.items || [];

  for (const canvas of canvases) {
    const canvasId = canvas.id;
    const canvasAnnotations = items.filter((item) => item.canvasId === canvasId);

    canvas.annotations = [
      {
        id: canvasId + '/annotations',
        type: 'AnnotationPage',
        items: canvasAnnotations.map((annotation) => ({
          id: canvasId + '/annotations/' + annotation.id,
          type: 'Annotation',
          motivation: annotation.motivation,
          body: annotation.body,
          target: annotation.target,
          ...(annotation.metadata ? { metadata: annotation.metadata } : {}),
        })),
      },
    ];
  }

  return manifestData;
}

/**
 * GET /api/annotations?manifestIds=<a,b,c>[&format=iiif]
 * 指定 manifest 群に紐づく（認証ユーザの）アノテーションを返す。
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (isAuthError(auth)) return auth.error;
  const userId = auth.userId;

  const manifestIdsParam = request.nextUrl.searchParams.get('manifestIds');
  const format = request.nextUrl.searchParams.get('format');

  if (!manifestIdsParam) {
    return NextResponse.json(
      { error: 'manifestIds query parameter is required' },
      { status: 400 }
    );
  }

  const manifestIds = manifestIdsParam
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (manifestIds.length === 0) {
    return NextResponse.json({ error: 'At least one manifestId is required' }, { status: 400 });
  }

  try {
    const annotations = await listAnnotationsByManifests(userId, manifestIds);

    if (format === 'iiif') {
      if (manifestIds.length === 1) {
        const manifest = await buildIIIFManifest(annotations[0].manifestId, annotations[0].items);
        return NextResponse.json(manifest);
      }
      const manifests = await Promise.all(
        annotations.map((a) => buildIIIFManifest(a.manifestId, a.items))
      );
      return NextResponse.json(manifests);
    }

    const response: ApiResponse = { userId, annotations };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/annotations
 * body: { manifestId, canvasId, target, body?, motivation?, type?, metadata? }
 * 認証ユーザのアノテーションを 1 件作成し、付与された id 付きで返す（201）。
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (isAuthError(auth)) return auth.error;

  let body: AnnotationInput;
  try {
    body = (await request.json()) as AnnotationInput;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const { valid, errors, value } = validateCreate(body);
  if (!valid) {
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
  }

  try {
    const created = await createAnnotation(auth.userId, value);
    return NextResponse.json({ annotation: created }, { status: 201 });
  } catch (error) {
    console.error('Error creating annotation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

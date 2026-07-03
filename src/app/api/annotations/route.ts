import { NextRequest, NextResponse } from 'next/server';
import { convertPresentation2 } from '@iiif/parser/presentation-2';
import { authenticate, isAuthError } from '@/lib/apiAuth';
import {
  createAnnotation,
  listAnnotationsByManifests,
  listCanvasAnnotations,
  listAllUserAnnotations,
  summarizeUserAnnotations,
  parseTagFilter,
  filterAnnotationsByTag,
  type AnnotationsByManifest,
  type SerializedAnnotation,
} from '@/lib/annotations/store';
import { validateCreate, type AnnotationInput } from '@/lib/annotations/validation';
import { assertNotInMaintenance } from '@/lib/maintenance';

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
          ...(annotation.tags && (annotation.tags as string[]).length
            ? { tags: annotation.tags }
            : {}),
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
  const canvasId = request.nextUrl.searchParams.get('canvasId');
  const mine = request.nextUrl.searchParams.get('mine');
  const summary = request.nextUrl.searchParams.get('summary');
  const tagFilter = parseTagFilter(request.nextUrl.searchParams.get('tag'));

  // summary=1: manifest×canvas の件数だけを返す（my-annotations の階層概要用。本文なし＝極小）。
  if (summary) {
    try {
      const manifests = await summarizeUserAnnotations(userId);
      return NextResponse.json({ userId, manifests });
    } catch (error) {
      console.error('Error summarizing annotations:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // mine=1: 認証ユーザの全アノテーションを平坦なリストで返す（my-annotations 用）。
  // read はシャード数だけで、旧来の「1件=1read で全件」より桁違いに軽い。
  if (mine) {
    try {
      const items = filterAnnotationsByTag(await listAllUserAnnotations(userId), tagFilter);
      return NextResponse.json({ userId, items });
    } catch (error) {
      console.error('Error fetching annotations:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

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
    // canvasId 指定時は該当 canvas のページ 1 ドキュメントだけを読む（= 1 read）。
    // エディタの canvas 単位表示はこの経路を使い、読み取り量を件数に依存させない。
    const rawAnnotations =
      canvasId && manifestIds.length === 1
        ? [
            {
              manifestId: manifestIds[0],
              items: await listCanvasAnnotations(userId, manifestIds[0], canvasId),
            },
          ]
        : await listAnnotationsByManifests(userId, manifestIds);

    // tag 絞り込み（tag=OCR / tag=-OCR など）。指定が無ければ素通り。
    const annotations = tagFilter
      ? rawAnnotations.map((a) => ({ ...a, items: filterAnnotationsByTag(a.items, tagFilter) }))
      : rawAnnotations;

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

  const blocked = await assertNotInMaintenance();
  if (blocked) return blocked;

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

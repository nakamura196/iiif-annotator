import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { validateApiKey } from '@/lib/apiKeyManager';
import { convertPresentation2 } from '@iiif/parser/presentation-2';

interface AnnotationsByManifest {
  manifestId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
}

interface ApiResponse {
  userId: string;
  annotations: AnnotationsByManifest[];
}

async function fetchAnnotations(userId: string, manifestIds: string[]): Promise<AnnotationsByManifest[]> {
  const db = getAdminFirestore();
  const annotations: AnnotationsByManifest[] = [];

  for (const manifestId of manifestIds) {
    const snapshot = await db
      .collection('annotations')
      .where('userId', '==', userId)
      .where('manifestId', '==', manifestId)
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        created: data.created?.toDate?.()?.toISOString() || null,
        modified: data.modified?.toDate?.()?.toISOString() || null,
      };
    });

    annotations.push({ manifestId, items });
  }

  return annotations;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildIIIFManifest(manifestId: string, items: any[]): Promise<any> {
  const r = await fetch(manifestId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let manifestData: any = await r.json();

  const context = manifestData['@context'];
  if (typeof context === 'string' && context.includes('presentation/2')) {
    manifestData = convertPresentation2(manifestData);
  } else if (Array.isArray(context) && context.some((c: string) => typeof c === 'string' && c.includes('presentation/2'))) {
    manifestData = convertPresentation2(manifestData);
  }

  const canvases = manifestData.items || [];

  for (const canvas of canvases) {
    const canvasId = canvas.id;
    const canvasAnnotations = items.filter(
      (item) => item.canvasId === canvasId
    );

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

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key');

  if (!apiKey) {
    return NextResponse.json(
      { error: 'X-API-Key header is required' },
      { status: 401 }
    );
  }

  const validation = await validateApiKey(apiKey);

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 401 }
    );
  }

  const userId = validation.userId!;
  const manifestIdsParam = request.nextUrl.searchParams.get('manifestIds');
  const format = request.nextUrl.searchParams.get('format');

  if (!manifestIdsParam) {
    return NextResponse.json(
      { error: 'manifestIds query parameter is required' },
      { status: 400 }
    );
  }

  const manifestIds = manifestIdsParam.split(',').map((id) => id.trim()).filter(Boolean);

  if (manifestIds.length === 0) {
    return NextResponse.json(
      { error: 'At least one manifestId is required' },
      { status: 400 }
    );
  }

  try {
    const annotations = await fetchAnnotations(userId, manifestIds);

    if (format === 'iiif') {
      // Single manifest: return IIIF manifest directly
      if (manifestIds.length === 1) {
        const manifest = await buildIIIFManifest(
          annotations[0].manifestId,
          annotations[0].items
        );
        return NextResponse.json(manifest);
      }

      // Multiple manifests: return array of IIIF manifests
      const manifests = await Promise.all(
        annotations.map((a) => buildIIIFManifest(a.manifestId, a.items))
      );
      return NextResponse.json(manifests);
    }

    // Default JSON format
    const response: ApiResponse = { userId, annotations };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

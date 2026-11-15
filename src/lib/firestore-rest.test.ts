import { describe, it, expect } from 'vitest';
import {
  Timestamp,
  encodeValue,
  decodeValue,
  encodeFields,
  decodeFields,
  Firestore,
  FirebaseAuthVerifier,
} from './firestore-rest';

describe('Timestamp', () => {
  it('keeps microsecond precision through an RFC 3339 round trip', () => {
    const ts = Timestamp.fromRfc3339('2025-06-09T12:34:56.123456Z');
    expect(ts.nanoseconds).toBe(123456000);
    expect(ts.toRfc3339()).toBe('2025-06-09T12:34:56.123456000Z');
    expect(ts.toDate().toISOString()).toBe('2025-06-09T12:34:56.123Z');
  });

  it('parses timestamps without a fraction', () => {
    expect(Timestamp.fromRfc3339('2025-06-09T00:00:00Z').toMillis()).toBe(Date.UTC(2025, 5, 9));
  });
});

describe('value encoding', () => {
  it('round-trips nested annotation-like data', () => {
    const created = new Date('2025-01-02T03:04:05.678Z');
    const doc = {
      userId: 'u1',
      shard: 0,
      items: [
        {
          id: 'abc_0:x',
          body: { type: 'TextualBody', value: '文字', '@context': 'x' },
          target: { selector: { value: 'xywh=1,2,3.5,4' } },
          tags: ['OCR'],
          ratio: 0.5,
          flag: true,
          none: null,
          created,
        },
      ],
    };
    const decoded = decodeFields(encodeFields(doc));
    const item = (decoded.items as Record<string, unknown>[])[0];
    expect(item.created).toBeInstanceOf(Timestamp);
    expect((item.created as Timestamp).toDate().toISOString()).toBe(created.toISOString());
    expect({ ...decoded, items: [{ ...item, created: undefined }] }).toEqual({
      ...doc,
      items: [{ ...doc.items[0], created: undefined }],
    });
  });

  it('encodes integers as integerValue and fractions as doubleValue', () => {
    expect(encodeValue(3)).toEqual({ integerValue: '3' });
    expect(encodeValue(3.25)).toEqual({ doubleValue: 3.25 });
    expect(decodeValue({ integerValue: '42' })).toBe(42);
  });

  it('drops undefined map fields like ignoreUndefinedProperties', () => {
    expect(encodeFields({ a: 1, b: undefined })).toEqual({ a: { integerValue: '1' } });
  });
});

function fakeFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: Array<{ url: string; body?: unknown }> = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return handler(url, init);
  }) as typeof fetch;
  return { fn, calls };
}

describe('Firestore REST client', () => {
  const root = 'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents';

  it('builds an AND query of equality filters with a limit', async () => {
    const { fn, calls } = fakeFetch(() =>
      Response.json([
        {
          document: {
            name: 'projects/p/databases/(default)/documents/annotationPages/doc1',
            fields: { userId: { stringValue: 'u' } },
          },
        },
        { readTime: 'x' },
      ])
    );
    const db = new Firestore('p', async () => 'tok', fn);
    const snap = await db.collection('annotationPages').where('userId', '==', 'u').where('shard', '==', 0).limit(1).get();
    expect(calls[0].url).toBe(`${root}:runQuery`);
    expect(calls[0].body).toEqual({
      structuredQuery: {
        from: [{ collectionId: 'annotationPages' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: 'u' } } },
              { fieldFilter: { field: { fieldPath: 'shard' }, op: 'EQUAL', value: { integerValue: '0' } } },
            ],
          },
        },
        limit: 1,
      },
    });
    expect(snap.size).toBe(1);
    expect(snap.docs[0].id).toBe('doc1');
    expect(snap.docs[0].data()).toEqual({ userId: 'u' });
  });

  it('reports a missing document as exists=false', async () => {
    const { fn } = fakeFetch(() => new Response('{}', { status: 404 }));
    const db = new Firestore('p', async () => 'tok', fn);
    const snap = await db.collection('c').doc('missing').get();
    expect(snap.exists).toBe(false);
    expect(snap.data()).toBeUndefined();
  });

  it('commits transaction writes with an update mask and retries on 409', async () => {
    let commits = 0;
    const { fn, calls } = fakeFetch((url) => {
      if (url.endsWith(':beginTransaction')) return Response.json({ transaction: 'T' });
      if (url.includes('/c/d1')) return Response.json({ name: 'x/c/d1', fields: { n: { integerValue: '1' } } });
      if (url.endsWith(':commit')) {
        commits++;
        return commits === 1 ? new Response('aborted', { status: 409 }) : Response.json({});
      }
      return new Response('unexpected', { status: 500 });
    });
    const db = new Firestore('p', async () => 'tok', fn);
    const ref = db.collection('c').doc('d1');
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      tx.update(ref, { n: (snap.data()!.n as number) + 1 });
      return 'done';
    });
    expect(result).toBe('done');
    expect(commits).toBe(2);
    expect(calls.find((c) => c.url.includes('/c/d1'))!.url).toBe(`${root}/c/d1?transaction=T`);
    expect(calls.filter((c) => c.url.endsWith(':commit')).at(-1)!.body).toEqual({
      transaction: 'T',
      writes: [
        {
          update: { name: 'projects/p/databases/(default)/documents/c/d1', fields: { n: { integerValue: '2' } } },
          updateMask: { fieldPaths: ['n'] },
          currentDocument: { exists: true },
        },
      ],
    });
  });
});

// --- ID token verification with a locally generated key ---------------------

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return Buffer.from(bytes).toString('base64url');
}

async function makeSigner() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const sign = async (payload: Record<string, unknown>, kid = 'k1') => {
    const h = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
    const p = b64url(JSON.stringify(payload));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${h}.${p}`));
    return `${h}.${p}.${b64url(new Uint8Array(sig))}`;
  };
  return { jwk: { ...jwk, kid: 'k1' }, sign };
}

describe('FirebaseAuthVerifier', () => {
  const now = Date.UTC(2026, 10, 15);
  const nowSec = now / 1000;
  const valid = {
    aud: 'p',
    iss: 'https://securetoken.google.com/p',
    sub: 'user-1',
    iat: nowSec - 10,
    exp: nowSec + 3600,
    auth_time: nowSec - 10,
  };

  async function setup() {
    const { jwk, sign } = await makeSigner();
    const { fn } = fakeFetch(() =>
      Response.json({ keys: [jwk] }, { headers: { 'cache-control': 'public, max-age=100' } })
    );
    return { verifier: new FirebaseAuthVerifier('p', fn, () => now), sign };
  }

  it('accepts a valid token and returns the uid', async () => {
    const { verifier, sign } = await setup();
    await expect(verifier.verifyIdToken(await sign(valid))).resolves.toMatchObject({ uid: 'user-1' });
  });

  it.each([
    ['wrong audience', { aud: 'other' }],
    ['wrong issuer', { iss: 'https://securetoken.google.com/other' }],
    ['expired', { exp: nowSec - 3600 }],
    ['empty subject', { sub: '' }],
  ])('rejects a token with %s', async (_label, override) => {
    const { verifier, sign } = await setup();
    await expect(verifier.verifyIdToken(await sign({ ...valid, ...override }))).rejects.toThrow();
  });

  it('rejects a tampered payload', async () => {
    const { verifier, sign } = await setup();
    const [h, , s] = (await sign(valid)).split('.');
    const forged = `${h}.${b64url(JSON.stringify({ ...valid, sub: 'admin' }))}.${s}`;
    await expect(verifier.verifyIdToken(forged)).rejects.toThrow('signature');
  });

  it('rejects an unknown key id', async () => {
    const { verifier, sign } = await setup();
    await expect(verifier.verifyIdToken(await sign(valid, 'other'))).rejects.toThrow('unknown key id');
  });
});

#!/usr/bin/env node
/**
 * End-to-end check of the annotation API against the real Firestore and Firebase Auth.
 * Run it by hand after a deploy (not in CI: it writes to production and needs the
 * service account key):
 *
 *   npm run test:api                              # https://anno.ldas.jp
 *   npm run test:api -- http://localhost:8788     # npm run preview:cf
 *
 * It signs in as a throwaway Firebase Auth user, then creates, reads, updates and
 * deletes an annotation and an API key through the HTTP API. Everything it creates
 * (Firestore documents and the auth user) is removed at the end, even on failure.
 *
 * Required env (injected by `op run --env-file=.env.local`):
 *   FIREBASE_SERVICE_ACCOUNT_BASE64, NEXT_PUBLIC_FIREBASE_API_KEY
 */
import admin from 'firebase-admin';

const BASE = (process.argv[2] || process.env.CHECK_API_BASE || 'https://anno.ldas.jp').replace(/\/$/, '');
const UID = 'check-api-e2e';
const MANIFEST = 'https://example.org/check-api-e2e/manifest.json';
const CANVAS = 'https://example.org/check-api-e2e/canvas/1';

for (const name of ['FIREBASE_SERVICE_ACCOUNT_BASE64', 'NEXT_PUBLIC_FIREBASE_API_KEY']) {
  if (!process.env[name]) {
    console.error(`${name} is not set. Run via: npm run test:api`);
    process.exit(2);
  }
}
const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString());
admin.initializeApp({ credential: admin.credential.cert(sa) });

const results = [];
const check = (label, cond, extra = '') => {
  results.push(cond);
  console.log(`${cond ? 'OK' : 'NG'}  ${label}${!cond && extra ? ' — ' + extra : ''}`);
};
const call = async (method, path, { token, apiKey, body } = {}) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (apiKey) headers['x-api-key'] = apiKey;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: r.status, json };
};
const brief = (v, n = 200) => JSON.stringify(v).slice(0, n);

console.log(`Target: ${BASE}`);
let annId, keyId, token;
try {
  const custom = await admin.auth().createCustomToken(UID);
  const ex = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    }
  ).then((r) => r.json());
  token = ex.idToken;
  check('got ID token for test user', !!token, ex.error?.message);
  if (!token) throw new Error('cannot continue without an ID token');

  const bad = await call('GET', '/api/annotations?mine=1', { token: token.slice(0, -4) + 'AAAA' });
  check('tampered ID token rejected', bad.status === 401, String(bad.status));

  const created = await call('POST', '/api/annotations', {
    token,
    body: {
      manifestId: MANIFEST,
      canvasId: CANVAS,
      body: { type: 'TextualBody', value: 'テスト' },
      target: { source: CANVAS, selector: { type: 'FragmentSelector', value: 'xywh=10,20,30,40' } },
      tags: ['e2e'],
    },
  });
  annId = created.json?.annotation?.id;
  check('POST annotation (Bearer)', created.status === 201 && !!annId, `${created.status} ${brief(created.json)}`);

  const got = await call('GET', `/api/annotations/${encodeURIComponent(annId)}`, { token });
  check('GET annotation by id', got.status === 200, `${got.status} ${brief(got.json)}`);

  const upd = await call('PUT', `/api/annotations/${encodeURIComponent(annId)}`, {
    token,
    body: { body: { type: 'TextualBody', value: '更新済み' } },
  });
  check('PUT annotation', upd.status === 200, `${upd.status} ${brief(upd.json)}`);

  const list = await call('GET', `/api/annotations?manifestIds=${encodeURIComponent(MANIFEST)}`, { token });
  check('GET by manifest shows update', list.status === 200 && brief(list.json, Infinity).includes('更新済み'), brief(list.json));

  const key = await call('POST', '/api/api-keys', { token, body: { name: UID, expiresInDays: 1 } });
  keyId = key.json?.id;
  check('POST api-key', key.status === 200 && !!key.json?.key, String(key.status));

  const keys = await call('GET', '/api/api-keys', { token });
  check('GET api-keys (timestamps decode)', keys.status === 200 && brief(keys.json, Infinity).includes(UID), brief(keys.json, 300));

  const viaKey = await call('GET', '/api/annotations?mine=1', { apiKey: key.json?.key });
  check('GET mine with X-API-Key', viaKey.status === 200 && brief(viaKey.json, Infinity).includes(annId), String(viaKey.status));

  const delA = await call('DELETE', `/api/annotations/${encodeURIComponent(annId)}`, { token });
  check('DELETE annotation', delA.status === 200 || delA.status === 204, String(delA.status));
  if (delA.status < 300) annId = undefined;

  const after = await call('GET', '/api/annotations?mine=1', { token });
  check('annotation gone', after.status === 200 && (after.json?.items?.length ?? -1) === 0, brief(after.json));

  const delK = await call('DELETE', `/api/api-keys/${keyId}`, { token });
  check('DELETE api-key', delK.status === 200, String(delK.status));
  if (delK.status === 200) keyId = undefined;
} catch (e) {
  check('unexpected error', false, String(e));
} finally {
  if (annId && token) await call('DELETE', `/api/annotations/${encodeURIComponent(annId)}`, { token }).catch(() => {});
  if (keyId && token) await call('DELETE', `/api/api-keys/${keyId}`, { token }).catch(() => {});
  // Remove leftovers for the test user (annotation shards, revoked key docs).
  const db = admin.firestore();
  for (const col of ['annotationPages', 'api_keys']) {
    const snap = await db.collection(col).where('userId', '==', UID).get();
    for (const d of snap.docs) await d.ref.delete();
    if (snap.size) console.log(`cleanup: removed ${snap.size} doc(s) from ${col}`);
  }
  await admin
    .auth()
    .deleteUser(UID)
    .catch((e) => {
      if (e.code !== 'auth/user-not-found') console.log('cleanup: could not delete test user:', e.code);
    });
}

const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);

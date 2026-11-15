// Minimal Firestore / Firebase Auth client for the server, built on the public REST API
// and Web Crypto only.
//
// Why not firebase-admin: the app runs on Cloudflare Workers (via OpenNext). firebase-admin's
// Firestore client depends on gRPC and protobufjs code generation (`new Function`), which the
// Workers runtime forbids ("Code generation from strings disallowed for this context").
// It is also large enough to push the Worker past the 3 MiB free-plan size limit.
//
// This module implements only the subset of the Admin SDK surface the app uses, with the same
// method names, so call sites (and the in-memory fakes in tests) stay unchanged:
//   db.collection(c).doc(id).get() / set() / update() / delete()
//   db.collection(c).add(data)
//   db.collection(c).where(f, '==', v).where(...).limit(n).get()
//   db.runTransaction(async (tx) => { tx.get(ref); tx.set/update/delete(ref, ...) })
//   Timestamp.now() / Timestamp.fromDate() / ts.toDate() / ts.toMillis()
//   auth.verifyIdToken(idToken) -> { uid, ... }

export type DocumentData = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------------------------------------------------------------------------
// Timestamp
// ---------------------------------------------------------------------------

export class Timestamp {
  constructor(
    readonly seconds: number,
    readonly nanoseconds: number
  ) {}

  static now(): Timestamp {
    return Timestamp.fromMillis(Date.now());
  }

  static fromDate(d: Date): Timestamp {
    return Timestamp.fromMillis(d.getTime());
  }

  static fromMillis(ms: number): Timestamp {
    const seconds = Math.floor(ms / 1000);
    return new Timestamp(seconds, Math.round((ms - seconds * 1000) * 1e6));
  }

  /** Parses an RFC 3339 string as returned by Firestore, keeping sub-millisecond precision. */
  static fromRfc3339(s: string): Timestamp {
    const m = /^(.*?)(?:\.(\d{1,9}))?(Z|[+-]\d\d:\d\d)$/.exec(s);
    if (!m) return Timestamp.fromMillis(Date.parse(s));
    const seconds = Math.floor(Date.parse(`${m[1]}${m[3]}`) / 1000);
    const nanos = m[2] ? Number(m[2].padEnd(9, '0')) : 0;
    return new Timestamp(seconds, nanos);
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }

  toRfc3339(): string {
    const base = new Date(this.seconds * 1000).toISOString().slice(0, 19);
    return `${base}.${String(this.nanoseconds).padStart(9, '0')}Z`;
  }
}

// ---------------------------------------------------------------------------
// Value encoding (JS <-> Firestore REST "Value")
// ---------------------------------------------------------------------------

type FsValue = Record<string, unknown>;

export function encodeValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Timestamp) return { timestampValue: v.toRfc3339() };
  if (v instanceof Date) return { timestampValue: Timestamp.fromDate(v).toRfc3339() };
  switch (typeof v) {
    case 'boolean':
      return { booleanValue: v };
    case 'number':
      return Number.isSafeInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    case 'bigint':
      return { integerValue: v.toString() };
    case 'string':
      return { stringValue: v };
  }
  if (Array.isArray(v)) {
    // Firestore has no "undefined"; like the Admin SDK with ignoreUndefinedProperties we
    // store array holes as null to keep indices stable.
    return { arrayValue: { values: v.map((x) => encodeValue(x)) } };
  }
  if (typeof v === 'object') {
    return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } };
  }
  throw new Error(`Unsupported Firestore value type: ${typeof v}`);
}

export function encodeFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (val === undefined) continue; // same as ignoreUndefinedProperties
    out[k] = encodeValue(val);
  }
  return out;
}

export function decodeValue(v: FsValue): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return Timestamp.fromRfc3339(v.timestampValue as string);
  if ('arrayValue' in v) {
    const values = ((v.arrayValue as { values?: FsValue[] }).values ?? []) as FsValue[];
    return values.map(decodeValue);
  }
  if ('mapValue' in v) {
    return decodeFields(((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {}));
  }
  if ('referenceValue' in v) return v.referenceValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  throw new Error(`Unsupported Firestore value: ${Object.keys(v).join(',')}`);
}

export function decodeFields(fields: Record<string, FsValue> | undefined): DocumentData {
  const out: DocumentData = {};
  for (const [k, val] of Object.entries(fields ?? {})) out[k] = decodeValue(val);
  return out;
}

function quoteFieldPath(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
    ? name
    : '`' + name.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`';
}

// ---------------------------------------------------------------------------
// Base64url / PEM helpers (Web Crypto)
// ---------------------------------------------------------------------------

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// ---------------------------------------------------------------------------
// Service account credentials and OAuth access token
// ---------------------------------------------------------------------------

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export class GoogleAccessTokenProvider {
  private token: { value: string; expiresAt: number } | null = null;
  private keyPromise: Promise<CryptoKey> | null = null;

  constructor(
    private readonly sa: ServiceAccount,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a)
  ) {}

  private key(): Promise<CryptoKey> {
    this.keyPromise ??= crypto.subtle.importKey(
      'pkcs8',
      pemToDer(this.sa.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return this.keyPromise;
  }

  async get(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.expiresAt - 60 > now) return this.token.value;

    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64UrlEncode(
      JSON.stringify({
        iss: this.sa.client_email,
        scope: 'https://www.googleapis.com/auth/datastore',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })
    );
    const sig = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      await this.key(),
      new TextEncoder().encode(`${header}.${claims}`)
    );
    const assertion = `${header}.${claims}.${base64UrlEncode(new Uint8Array(sig))}`;

    const res = await this.fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });
    if (!res.ok) {
      throw new Error(`Google OAuth token request failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expiresAt: now + json.expires_in };
    return json.access_token;
  }
}

// ---------------------------------------------------------------------------
// Firestore
// ---------------------------------------------------------------------------

export class FirestoreRestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'FirestoreRestError';
  }
}

interface RestDocument {
  name: string;
  fields?: Record<string, FsValue>;
}

export class DocumentSnapshot {
  constructor(
    readonly id: string,
    private readonly fields: Record<string, FsValue> | null
  ) {}
  get exists(): boolean {
    return this.fields !== null;
  }
  data(): DocumentData | undefined {
    return this.fields === null ? undefined : decodeFields(this.fields);
  }
}

export interface QuerySnapshot {
  docs: DocumentSnapshot[];
  empty: boolean;
  size: number;
}

type Write = Record<string, unknown>;

export class DocumentReference {
  constructor(
    private readonly db: Firestore,
    readonly collectionId: string,
    readonly id: string
  ) {}

  /** Full resource name: projects/<p>/databases/(default)/documents/<c>/<id> */
  get name(): string {
    return `${this.db.documentsRoot}/${this.collectionId}/${this.id}`;
  }

  get(): Promise<DocumentSnapshot> {
    return this.db.getDocument(this);
  }

  async set(data: DocumentData): Promise<void> {
    await this.db.commit([this.db.setWrite(this, data)]);
  }

  async update(data: DocumentData): Promise<void> {
    await this.db.commit([this.db.updateWrite(this, data)]);
  }

  async delete(): Promise<void> {
    await this.db.commit([{ delete: this.name }]);
  }
}

type Filter = { field: string; value: unknown };

export class Query {
  constructor(
    protected readonly db: Firestore,
    readonly collectionId: string,
    private readonly filters: Filter[] = [],
    private readonly limitN?: number
  ) {}

  where(field: string, op: '==', value: unknown): Query {
    if (op !== '==') throw new Error(`Only '==' filters are supported (got '${op}')`);
    return new Query(this.db, this.collectionId, [...this.filters, { field, value }], this.limitN);
  }

  limit(n: number): Query {
    return new Query(this.db, this.collectionId, this.filters, n);
  }

  get(): Promise<QuerySnapshot> {
    const fieldFilters = this.filters.map((f) => ({
      fieldFilter: {
        field: { fieldPath: quoteFieldPath(f.field) },
        op: 'EQUAL',
        value: encodeValue(f.value),
      },
    }));
    const structuredQuery: Record<string, unknown> = { from: [{ collectionId: this.collectionId }] };
    if (fieldFilters.length === 1) structuredQuery.where = fieldFilters[0];
    if (fieldFilters.length > 1) {
      structuredQuery.where = { compositeFilter: { op: 'AND', filters: fieldFilters } };
    }
    if (this.limitN !== undefined) structuredQuery.limit = this.limitN;
    return this.db.runQuery(structuredQuery);
  }
}

export class CollectionReference extends Query {
  doc(id?: string): DocumentReference {
    return new DocumentReference(this.db, this.collectionId, id ?? autoId());
  }

  async add(data: DocumentData): Promise<DocumentReference> {
    const ref = this.doc();
    await this.db.commit([{ ...this.db.setWrite(ref, data), currentDocument: { exists: false } }]);
    return ref;
  }
}

function autoId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let id = '';
  for (const b of bytes) id += chars[b % chars.length];
  return id;
}

export class Transaction {
  readonly writes: Write[] = [];
  constructor(
    private readonly db: Firestore,
    readonly id: string
  ) {}

  get(ref: DocumentReference): Promise<DocumentSnapshot> {
    return this.db.getDocument(ref, this.id);
  }
  set(ref: DocumentReference, data: DocumentData): this {
    this.writes.push(this.db.setWrite(ref, data));
    return this;
  }
  update(ref: DocumentReference, data: DocumentData): this {
    this.writes.push(this.db.updateWrite(ref, data));
    return this;
  }
  delete(ref: DocumentReference): this {
    this.writes.push({ delete: ref.name });
    return this;
  }
}

const MAX_TRANSACTION_ATTEMPTS = 5;

export class Firestore {
  readonly documentsRoot: string;
  private readonly baseUrl: string;

  constructor(
    readonly projectId: string,
    private readonly getToken: () => Promise<string>,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a)
  ) {
    this.documentsRoot = `projects/${projectId}/databases/(default)/documents`;
    this.baseUrl = `https://firestore.googleapis.com/v1/${this.documentsRoot}`;
  }

  collection(id: string): CollectionReference {
    return new CollectionReference(this, id);
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    return res;
  }

  private async json<T>(res: Response, what: string): Promise<T> {
    if (!res.ok) {
      throw new FirestoreRestError(res.status, `Firestore ${what} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  async getDocument(ref: DocumentReference, transaction?: string): Promise<DocumentSnapshot> {
    const qs = transaction ? `?transaction=${encodeURIComponent(transaction)}` : '';
    const res = await this.request(
      `/${encodeURIComponent(ref.collectionId)}/${encodeURIComponent(ref.id)}${qs}`
    );
    if (res.status === 404) {
      await res.body?.cancel();
      return new DocumentSnapshot(ref.id, null);
    }
    const doc = await this.json<RestDocument>(res, 'get');
    return new DocumentSnapshot(ref.id, doc.fields ?? {});
  }

  async runQuery(structuredQuery: Record<string, unknown>): Promise<QuerySnapshot> {
    const res = await this.request(':runQuery', {
      method: 'POST',
      body: JSON.stringify({ structuredQuery }),
    });
    const rows = await this.json<Array<{ document?: RestDocument }>>(res, 'runQuery');
    const docs = rows
      .filter((r) => r.document)
      .map((r) => {
        const name = r.document!.name;
        return new DocumentSnapshot(name.slice(name.lastIndexOf('/') + 1), r.document!.fields ?? {});
      });
    return { docs, empty: docs.length === 0, size: docs.length };
  }

  setWrite(ref: DocumentReference, data: DocumentData): Write {
    return { update: { name: ref.name, fields: encodeFields(data) } };
  }

  updateWrite(ref: DocumentReference, data: DocumentData): Write {
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    return {
      update: { name: ref.name, fields: encodeFields(data) },
      updateMask: { fieldPaths: keys.map(quoteFieldPath) },
      currentDocument: { exists: true },
    };
  }

  async commit(writes: Write[], transaction?: string): Promise<void> {
    const res = await this.request(':commit', {
      method: 'POST',
      body: JSON.stringify(transaction ? { writes, transaction } : { writes }),
    });
    await this.json(res, 'commit');
  }

  async runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt++) {
      const begin = await this.json<{ transaction: string }>(
        await this.request(':beginTransaction', { method: 'POST', body: '{}' }),
        'beginTransaction'
      );
      const tx = new Transaction(this, begin.transaction);
      let result: T;
      try {
        result = await fn(tx);
      } catch (e) {
        await this.rollback(begin.transaction);
        throw e;
      }
      try {
        await this.commit(tx.writes, begin.transaction);
        return result;
      } catch (e) {
        // 409 ABORTED = contention with another transaction; retry like the Admin SDK does.
        if (e instanceof FirestoreRestError && e.status === 409) {
          lastError = e;
          continue;
        }
        throw e;
      }
    }
    throw lastError;
  }

  private async rollback(transaction: string): Promise<void> {
    try {
      const res = await this.request(':rollback', {
        method: 'POST',
        body: JSON.stringify({ transaction }),
      });
      await res.body?.cancel();
    } catch {
      // Best effort: an un-committed transaction expires on its own.
    }
  }
}

// ---------------------------------------------------------------------------
// Firebase Auth ID token verification
// ---------------------------------------------------------------------------

const SECURETOKEN_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const CLOCK_SKEW_SECONDS = 300;

export interface DecodedIdToken {
  uid: string;
  [claim: string]: unknown;
}

type Jwk = JsonWebKey & { kid: string };

export class FirebaseAuthVerifier {
  private keys: { byKid: Map<string, Promise<CryptoKey>>; expiresAt: number } | null = null;

  constructor(
    private readonly projectId: string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    private readonly now: () => number = () => Date.now()
  ) {}

  private async publicKey(kid: string): Promise<CryptoKey> {
    if (!this.keys || this.keys.expiresAt <= this.now() || !this.keys.byKid.has(kid)) {
      const res = await this.fetchImpl(SECURETOKEN_JWKS_URL);
      if (!res.ok) throw new Error(`Failed to fetch Firebase signing keys: ${res.status}`);
      const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
      const { keys } = (await res.json()) as { keys: Jwk[] };
      const byKid = new Map<string, Promise<CryptoKey>>();
      for (const jwk of keys) {
        byKid.set(
          jwk.kid,
          crypto.subtle.importKey(
            'jwk',
            { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify']
          )
        );
      }
      this.keys = { byKid, expiresAt: this.now() + maxAge * 1000 };
    }
    const key = this.keys.byKid.get(kid);
    if (!key) throw new Error('ID token has an unknown key id');
    return key;
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('ID token is not a JWT');
    const [h, p, s] = parts;
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(h))) as { alg?: string; kid?: string };
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(p))) as Record<string, unknown>;

    if (header.alg !== 'RS256') throw new Error('ID token has an unexpected algorithm');
    if (!header.kid) throw new Error('ID token has no key id');

    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      await this.publicKey(header.kid),
      base64UrlDecode(s),
      new TextEncoder().encode(`${h}.${p}`)
    );
    if (!ok) throw new Error('ID token signature is invalid');

    const nowSec = Math.floor(this.now() / 1000);
    if (payload.aud !== this.projectId) throw new Error('ID token has an unexpected audience');
    if (payload.iss !== `https://securetoken.google.com/${this.projectId}`) {
      throw new Error('ID token has an unexpected issuer');
    }
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) {
      throw new Error('ID token has an invalid subject');
    }
    if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS < nowSec) {
      throw new Error('ID token has expired');
    }
    if (typeof payload.iat !== 'number' || payload.iat - CLOCK_SKEW_SECONDS > nowSec) {
      throw new Error('ID token was issued in the future');
    }
    if (typeof payload.auth_time === 'number' && payload.auth_time - CLOCK_SKEW_SECONDS > nowSec) {
      throw new Error('ID token has an invalid auth_time');
    }
    return { ...payload, uid: payload.sub };
  }
}
